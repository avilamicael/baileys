import app from "@/app";
import baileys from "@/baileys";
import config from "@/config";
import { errorToString } from "@/helpers/errorToString";
import logger, { deepSanitizeObject } from "@/lib/logger";
import redis, { initializeRedis } from "@/lib/redis";
import { REDIS_KEY_PREFIX } from "@/middlewares/auth";
import { MediaCleanupService } from "@/services/mediaCleanup";

process.on("uncaughtException", (error) => {
  logger.error(
    "[UNCAUGHT EXCEPTION] An uncaught exception occurred: %s",
    errorToString(error),
  );
});

process.on("unhandledRejection", (reason, promise) => {
  logger.error(
    "[UNHANDLED_REJECTION] An unhandled promise rejection occurred at: %o, reason: %s",
    promise,
    errorToString(reason as Error),
  );
});

const mediaCleanup = new MediaCleanupService({
  maxAgeHours: config.media.maxAgeHours,
  intervalMs: config.media.cleanupIntervalMs,
});

// Large media is streamed from a URL (tiny request body); this limit only
// guards the base64 fallback path. Override with MAX_REQUEST_BODY_SIZE_MB.
const maxRequestBodySize =
  Number(process.env.MAX_REQUEST_BODY_SIZE_MB ?? 64) * 1024 * 1024;

app.listen({ port: config.port, maxRequestBodySize }, () => {
  logger.info(
    `${config.packageInfo.name}@${config.packageInfo.version} running on ${app.server?.hostname}:${app.server?.port}`,
  );
  logger.info(
    "Loaded config %s",
    JSON.stringify(
      deepSanitizeObject(config, { omitKeys: ["password"] }),
      null,
      2,
    ),
  );

  if (config.media.cleanupEnabled) {
    mediaCleanup.start();
  }

  initializeRedis().then(async () => {
    const apiKey = process.env.API_KEY;
    if (apiKey) {
      const redisKey = `${REDIS_KEY_PREFIX}:${apiKey}`;
      const existing = await redis.get(redisKey);
      if (!existing) {
        await redis.set(redisKey, JSON.stringify({ role: "admin" }));
        logger.info("Auto-seeded API_KEY into Redis");
      }
    }

    return baileys.reconnectFromAuthStore().catch((error) => {
      logger.error(
        "Failed to reconnect from auth store: %s",
        errorToString(error),
      );
    });
  });
});

const shutdown = (signal: string) => {
  logger.info(`Received ${signal}, shutting down gracefully...`);
  mediaCleanup.stop();
  process.exit(0);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
