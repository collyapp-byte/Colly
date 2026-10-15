import OpenAI from "openai";
import { alertProviderState, sendAlert } from "@/lib/alerts";
import type {
  ChatCompletion,
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionMessageParam,
  ChatCompletionMessageToolCall,
  ChatCompletionTool,
} from "openai/resources/chat/completions";

// ---------------------------------------------------------------------------
// AI fallback chain
//
// DeepSeek is the primary brain, but billing issues or outages must never leave
// a customer without a reply. Every request walks down the chain
// DeepSeek -> Groq -> OpenRouter, and if all three fail we return a friendly
// static message instead of an error.
//
// All three providers expose an OpenAI-compatible API, so the official OpenAI
// SDK is reused and only the base URL + key are swapped.
// ---------------------------------------------------------------------------

export type AIProvider = "deepseek" | "groq" | "openrouter" | "fallback";

/**
 * A chat message the way our own code builds it. `content` is `any` because the
 * vision model sends an array of text/image parts, and tool messages carry a
 * string. The optional fields keep OpenAI-style tool calling working.
 */
export type AIMessage = {
  role: "system" | "user" | "assistant" | "tool";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- content is a string for text/tool turns and an array of parts for multimodal turns.
  content: any;
  name?: string;
  tool_call_id?: string;
  tool_calls?: ChatCompletionMessageToolCall[];
};

export type AIResult = {
  reply: string;
  provider: AIProvider;
  /**
   * The raw completion from the provider that answered. Present whenever a real
   * provider succeeded, and needed by callers that inspect `tool_calls`. Absent
   * for the static fallback.
   */
  completion?: ChatCompletion;
  /** Tool calls the model asked for, if any (empty otherwise). */
  toolCalls?: ChatCompletionMessageToolCall[];
};

// Re-exported for callers that used the old lib/deepseek.ts types.
export type ChatMessage = AIMessage;
export type ChatTool = ChatCompletionTool;
export type ChatToolCall = ChatCompletionMessageToolCall;

export const FALLBACK_REPLY =
  "Sorry, I'm having a small issue on my end. Let me get the team to help you with this. Please give me a moment.";

type ProviderConfig = {
  name: "deepseek" | "groq" | "openrouter";
  /** Human-readable name used in log lines. */
  label: string;
  model: string;
  apiKeyEnv: string;
  baseUrlEnv: string;
  defaultBaseUrl: string;
  timeoutMs: number;
};

const PROVIDERS: ProviderConfig[] = [
  {
    name: "deepseek",
    label: "DeepSeek",
    model: "deepseek-chat",
    apiKeyEnv: "DEEPSEEK_API_KEY",
    baseUrlEnv: "DEEPSEEK_BASE_URL",
    defaultBaseUrl: "https://api.deepseek.com",
    timeoutMs: 15_000,
  },
  {
    name: "groq",
    label: "Groq",
    model: "openai/gpt-oss-120b",
    apiKeyEnv: "GROQ_API_KEY",
    baseUrlEnv: "GROQ_BASE_URL",
    defaultBaseUrl: "https://api.groq.com/openai/v1",
    timeoutMs: 15_000,
  },
  {
    name: "openrouter",
    label: "OpenRouter",
    model: "nvidia/nemotron-3-ultra-550b-a55b:free",
    apiKeyEnv: "OPENROUTER_API_KEY",
    baseUrlEnv: "OPENROUTER_BASE_URL",
    defaultBaseUrl: "https://openrouter.ai/api/v1",
    timeoutMs: 20_000,
  },
];

// One shared client per provider, created lazily and only when its key exists.
const clients = new Map<string, OpenAI>();

function getClient(config: ProviderConfig): OpenAI | null {
  const apiKey = process.env[config.apiKeyEnv];
  if (!apiKey) {
    return null;
  }

  let client = clients.get(config.name);
  if (!client) {
    client = new OpenAI({
      apiKey,
      baseURL: process.env[config.baseUrlEnv] ?? config.defaultBaseUrl,
    });
    clients.set(config.name, client);
  }

  return client;
}

/** Reject with `"timeout"` if `promise` has not settled within `ms`. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/**
 * Ask the AI for a reply, walking the fallback chain until one provider answers.
 *
 * When `tools` is supplied the provider may answer with tool calls instead of
 * text; those are surfaced on `AIResult.toolCalls` (with the raw `completion`)
 * so the caller can run them and continue. Individual provider failures are
 * caught and logged, never thrown, so a single outage cannot fail the request.
 */
export async function askAI(
  messages: AIMessage[],
  tools?: ChatTool[],
): Promise<AIResult> {
  const useTools = Array.isArray(tools) && tools.length > 0;

  let lastError = "unknown error";

  for (const config of PROVIDERS) {
    const client = getClient(config);

    if (!client) {
      lastError = `${config.apiKeyEnv} not set`;
      console.warn(
        `[ai] provider=${config.name} skipped: ${config.apiKeyEnv} not set`,
      );
      continue;
    }

    try {
      const body: ChatCompletionCreateParamsNonStreaming = {
        model: config.model,
        messages: messages as ChatCompletionMessageParam[],
        ...(useTools
          ? { tools: tools as ChatTool[], tool_choice: "auto" as const }
          : {}),
      };

      const completion = await withTimeout(
        client.chat.completions.create(body),
        config.timeoutMs,
      );

      const message = completion.choices[0]?.message;
      const content = typeof message?.content === "string" ? message.content : "";
      const toolCalls = message?.tool_calls ?? [];

      // A tool call with no text is still a successful answer: hand it back so
      // the caller can run the tool and ask again.
      if (!content.trim() && toolCalls.length === 0) {
        lastError = "empty response";
        console.warn(`[ai] provider=${config.name} failed: empty response`);
        void alertProviderState(config.name, "down", "empty response");
        continue;
      }

      console.log(`[ai] provider=${config.name} success`);
      void alertProviderState(config.name, "up");

      return {
        reply: content.trim(),
        provider: config.name,
        completion,
        toolCalls,
      };
    } catch (error) {
      const reason =
        error instanceof Error ? error.message : String(error);
      lastError = reason;
      console.warn(`[ai] ${config.label} failed: ${reason}`);
      console.warn(`[ai] provider=${config.name} failed: ${reason}`);
      void alertProviderState(config.name, "down", reason);
    }
  }

  console.error("[ai] all providers failed, using static fallback");
  void sendAlert(
    `All AI providers failed. Customer got static reply. Last error: ${lastError.slice(0, 200)}`,
    "critical",
  );
  return { reply: FALLBACK_REPLY, provider: "fallback" };
}
