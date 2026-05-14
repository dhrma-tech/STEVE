import { generateSandboxChatResponse } from "@/lib/ai/sandbox-chat";
import {
  finalizeChatMessage,
  prepareChatMessage,
  type ChatMessagePreparation
} from "@/lib/chat/data";

type StreamChatInput = {
  orgId: string;
  threadId: string;
  body: string;
  fileIds?: string[];
  attachmentNames?: string[];
  mentions?: string[];
};

type SseEvent =
  | { event: "preparing"; data: Record<string, unknown> }
  | { event: "thinking"; data: { body: string } }
  | { event: "token"; data: { delta: string } }
  | { event: "complete"; data: { thread: unknown } }
  | { event: "error"; data: { message: string } };

const TOKEN_CHUNK_CHARS = 18;
const TOKEN_CHUNK_DELAY_MS = 24;

function encode(event: SseEvent) {
  return `event: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`;
}

function splitForStreaming(body: string): string[] {
  const tokens: string[] = [];
  let cursor = 0;
  while (cursor < body.length) {
    const remaining = body.length - cursor;
    const size = Math.min(TOKEN_CHUNK_CHARS, remaining);
    let chunk = body.slice(cursor, cursor + size);
    if (cursor + size < body.length) {
      const lastSpace = chunk.lastIndexOf(" ");
      if (lastSpace > 6) {
        chunk = chunk.slice(0, lastSpace + 1);
      }
    }
    tokens.push(chunk);
    cursor += chunk.length;
  }
  return tokens;
}

/**
 * Build a ReadableStream of SSE events for a chat message. Yields:
 *   1. `preparing`  — minimal context echo (orgId / threadId / attachments).
 *   2. `thinking`   — the rationale block of the AI response, surfaced
 *                     immediately so the UI can render a typing indicator.
 *   3. `token`      — repeated chunks of the answer body.
 *   4. `complete`   — the canonical thread detail snapshot after persistence.
 *
 * The sandbox AI response is deterministic and synchronous; we still stream it
 * token-by-token so the UX matches the eventual real-provider behavior. When a
 * provider runtime swaps in, this generator can hand off to its native stream
 * without changing the client contract.
 */
export function buildChatMessageStream(input: StreamChatInput): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      function emit(event: SseEvent) {
        controller.enqueue(encoder.encode(encode(event)));
      }

      try {
        const preparation = await prepareChatMessage(input);
        if (!preparation) {
          emit({ event: "error", data: { message: "Chat thread not found." } });
          controller.close();
          return;
        }

        emit({
          event: "preparing",
          data: {
            attachments: preparation.attachments.map((file) => ({ id: file.id, name: file.name })),
            mentionKeys: preparation.mentions.map((mention) => mention.key)
          }
        });

        const response = generateSandboxChatResponse({
          body: preparation.trimmedBody,
          organizationName: preparation.organizationName,
          threadKind: preparation.thread.kind,
          mentions: preparation.mentions,
          attachmentNames: preparation.attachments.map((file) => file.name)
        });

        const { thinking, answer } = splitThinkingFromBody(response.body);
        if (thinking) {
          emit({ event: "thinking", data: { body: thinking } });
        }

        for (const chunk of splitForStreaming(answer)) {
          emit({ event: "token", data: { delta: chunk } });
          await delay(TOKEN_CHUNK_DELAY_MS);
        }

        const thread = await finalizeChatMessage({
          orgId: input.orgId,
          threadId: input.threadId,
          preparation: preparation as ChatMessagePreparation,
          responseBody: response.body,
          responseMetadata: { ...response.metadata, transport: "sse" }
        });

        emit({ event: "complete", data: { thread } });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Streaming failed.";
        emit({ event: "error", data: { message } });
      } finally {
        controller.close();
      }
    }
  });
}

function splitThinkingFromBody(body: string): { thinking: string | null; answer: string } {
  const match = body.match(/^<thinking>\n?([\s\S]*?)\n?<\/thinking>\s*([\s\S]*)$/);
  if (!match) return { thinking: null, answer: body };
  return { thinking: match[1].trim() || null, answer: match[2].trim() };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
