import type { AnyMessageContent, WAMessage } from "@whiskeysockets/baileys";
import type { Static } from "elysia";
import type {
  anyMessageContent,
  editableMessageContent,
  quotedMessage,
} from "./types";

type QuotedMessageInput = Static<typeof quotedMessage>;

export interface BuildMessageContentResult {
  messageContent: AnyMessageContent;
  quoted?: WAMessage;
}

function extractQuoted(content: {
  quotedMessage?: QuotedMessageInput;
}): WAMessage | undefined {
  if (!content.quotedMessage) {
    return undefined;
  }
  return {
    key: content.quotedMessage.key,
    message: content.quotedMessage.message,
  };
}

// Base64 string -> Buffer (kept in memory) | { url } -> passed through so
// Baileys streams the file directly from the URL (low memory for large files).
function toMedia(value: string | { url: string }): Buffer | { url: string } {
  return typeof value === "string" ? Buffer.from(value, "base64") : value;
}

export function buildMessageContent(
  content: Static<typeof anyMessageContent>,
): BuildMessageContentResult {
  if ("text" in content) {
    const { quotedMessage, ...rest } = content;
    return {
      messageContent: rest,
      quoted: extractQuoted(content),
    };
  }
  if ("image" in content) {
    const { quotedMessage, ...rest } = content;
    return {
      messageContent: {
        ...rest,
        image: toMedia(content.image),
      },
      quoted: extractQuoted(content),
    };
  }
  if ("video" in content) {
    const { quotedMessage, ...rest } = content;
    return {
      messageContent: {
        ...rest,
        video: toMedia(content.video),
      },
      quoted: extractQuoted(content),
    };
  }
  if ("document" in content) {
    const { quotedMessage, ...rest } = content;
    return {
      messageContent: {
        ...rest,
        document: toMedia(content.document),
      },
      quoted: extractQuoted(content),
    };
  }
  if ("audio" in content) {
    const { quotedMessage, ...rest } = content;
    return {
      messageContent: {
        ...rest,
        audio: Buffer.from(content.audio, "base64"),
      },
      quoted: extractQuoted(content),
    };
  }
  if ("react" in content) {
    return { messageContent: { react: content.react } };
  }

  // NOTE: This should never happen
  throw new Error("Invalid message content");
}

export function buildEditableMessageContent(
  content: Static<typeof editableMessageContent>,
): AnyMessageContent {
  return content;
}
