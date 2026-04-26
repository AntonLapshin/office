import type { z } from "zod";
import type { Config, Provider } from "./config.js";
import { resolveProvider } from "./config.js";
import type { PersonaRole } from "./persona.js";
import { appendLog, appendSessionLog, appendPerf, appendLlmLog } from "./logger.js";

export interface LlmCallOptions {
  config: Config;
  role: PersonaRole;
  systemPrompt: string;
  userPrompt: string;
  projectRoot: string;
  sessionDir?: string;
}

export interface LlmJsonCallOptions<T> extends LlmCallOptions {
  schema: z.ZodSchema<T>;
}

function resolveModel(config: Config, provider: Provider, role: PersonaRole): string {
  return config.models[role] ?? provider.defaultModel;
}

function resolveApiKey(provider: Provider): string | undefined {
  if (!provider.apiKeyEnv) return undefined;
  const key = process.env[provider.apiKeyEnv];
  if (!key) {
    throw new Error(`API key env var "${provider.apiKeyEnv}" is not set`);
  }
  return key;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function log(opts: LlmCallOptions, source: string, message: string): void {
  if (opts.sessionDir) {
    appendSessionLog(opts.sessionDir, source, message);
  }
  appendLog(opts.projectRoot, source, message);
}

async function fetchOpenAI(
  provider: Provider,
  apiKey: string | undefined,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  timeoutMs: number,
): Promise<string> {
  const url = `${provider.baseUrl}/v1/chat/completions`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      stream: false,
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`HTTP ${response.status}: ${text}`);
  }

  const json = await response.json() as {
    choices?: { message?: { content?: string } }[];
  };

  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error("Empty response from LLM");
  return content;
}

async function fetchAnthropic(
  provider: Provider,
  apiKey: string | undefined,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  timeoutMs: number,
): Promise<string> {
  const url = `${provider.baseUrl}/v1/messages`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "anthropic-version": "2023-06-01",
  };
  if (apiKey) {
    headers["x-api-key"] = apiKey;
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`HTTP ${response.status}: ${text}`);
  }

  const json = await response.json() as {
    content?: { type: string; text?: string }[];
  };

  const text = json.content?.find((b) => b.type === "text")?.text;
  if (!text) throw new Error("Empty response from LLM");
  return text;
}

async function fetchCompletion(
  provider: Provider,
  apiKey: string | undefined,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  timeoutMs: number,
): Promise<string> {
  if (provider.api === "anthropic") {
    return fetchAnthropic(provider, apiKey, model, systemPrompt, userPrompt, timeoutMs);
  }
  return fetchOpenAI(provider, apiKey, model, systemPrompt, userPrompt, timeoutMs);
}

function cleanReasoning(text: string): string {
  let cleaned = text.replace(/<thought>[\s\S]*?<\/thought>/gi, "").trim();
  cleaned = cleaned.replace(/<thinking>[\s\S]*?<\/thinking>/gi, "").trim();
  return cleaned;
}

export async function callLlm(opts: LlmCallOptions): Promise<string> {
  const provider = resolveProvider(opts.config);
  const apiKey = resolveApiKey(provider);
  const model = resolveModel(opts.config, provider, opts.role);
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= opts.config.retries; attempt++) {
    if (opts.config.delayMs > 0) {
      await delay(opts.config.delayMs);
    }

    const start = Date.now();
    try {
      const response = await fetchCompletion(provider, apiKey, model, opts.systemPrompt, opts.userPrompt, opts.config.timeoutMs);
      const durationMs = Date.now() - start;

      log(opts, opts.role, `success | model=${model} | attempt=${attempt}/${opts.config.retries} | ${durationMs}ms`);
      appendPerf(opts.projectRoot, { role: opts.role, model, durationMs, status: "success", attempt });
      appendLlmLog(opts.projectRoot, {
        role: opts.role, model, durationMs, status: "success", attempt,
        systemPrompt: opts.systemPrompt, userPrompt: opts.userPrompt, response,
      });

      if (opts.config.logging) {
        console.log(`[office] ${opts.role} | model=${model} | attempt ${attempt}/${opts.config.retries} | ${durationMs}ms | success`);
      }

      const cleaned = cleanReasoning(response);
      return cleaned;
    } catch (err) {
      const durationMs = Date.now() - start;
      lastError = err instanceof Error ? err : new Error(String(err));
      const errorMsg = lastError.message;

      log(opts, opts.role, `error | model=${model} | attempt=${attempt}/${opts.config.retries} | ${durationMs}ms | ${errorMsg}`);
      appendPerf(opts.projectRoot, { role: opts.role, model, durationMs, status: "error", attempt, error: errorMsg });
      appendLlmLog(opts.projectRoot, {
        role: opts.role, model, durationMs, status: "error", attempt,
        systemPrompt: opts.systemPrompt, userPrompt: opts.userPrompt, response: "", error: errorMsg,
      });

      if (opts.config.logging) {
        console.error(`[office] ${opts.role} | model=${model} | attempt ${attempt}/${opts.config.retries} | ${durationMs}ms | error: ${errorMsg}`);
      }
    }
  }

  throw new Error(`${opts.role} failed after ${opts.config.retries} attempts: ${lastError?.message}`);
}

function stripLlmWrapping(text: string): string {
  let cleaned = cleanReasoning(text);
  const fenced = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (fenced) return fenced[1].trim();
  return cleaned.trim();
}

export async function callLlmJson<T>(opts: LlmJsonCallOptions<T>): Promise<T> {
  const provider = resolveProvider(opts.config);
  const apiKey = resolveApiKey(provider);
  const model = resolveModel(opts.config, provider, opts.role);
  let lastError: Error | null = null;
  const systemPrompt = opts.systemPrompt + "\n\nRespond with valid JSON only, no markdown fences.";

  for (let attempt = 1; attempt <= opts.config.retries; attempt++) {
    if (opts.config.delayMs > 0) {
      await delay(opts.config.delayMs);
    }

    const start = Date.now();
    try {
      const raw = await fetchCompletion(provider, apiKey, model, systemPrompt, opts.userPrompt, opts.config.timeoutMs);
      const durationMs = Date.now() - start;
      const cleaned = stripLlmWrapping(raw);
      const parsed = JSON.parse(cleaned);
      const validated = opts.schema.parse(parsed);

      log(opts, opts.role, `success | model=${model} | attempt=${attempt}/${opts.config.retries} | ${durationMs}ms`);
      appendPerf(opts.projectRoot, { role: opts.role, model, durationMs, status: "success", attempt });
      appendLlmLog(opts.projectRoot, {
        role: opts.role, model, durationMs, status: "success", attempt,
        systemPrompt, userPrompt: opts.userPrompt, response: raw,
      });

      if (opts.config.logging) {
        console.log(`[office] ${opts.role} | model=${model} | attempt ${attempt}/${opts.config.retries} | ${durationMs}ms | success`);
      }

      return validated;
    } catch (err) {
      const durationMs = Date.now() - start;
      lastError = err instanceof Error ? err : new Error(String(err));
      const errorMsg = lastError.message;

      log(opts, opts.role, `error | model=${model} | attempt=${attempt}/${opts.config.retries} | ${durationMs}ms | ${errorMsg}`);
      appendPerf(opts.projectRoot, { role: opts.role, model, durationMs, status: "error", attempt, error: errorMsg });
      appendLlmLog(opts.projectRoot, {
        role: opts.role, model, durationMs, status: "error", attempt,
        systemPrompt, userPrompt: opts.userPrompt, response: "", error: errorMsg,
      });

      if (opts.config.logging) {
        console.error(`[office] ${opts.role} | model=${model} | attempt ${attempt}/${opts.config.retries} | ${durationMs}ms | error: ${errorMsg}`);
      }
    }
  }

  throw new Error(`${opts.role} failed after ${opts.config.retries} attempts: ${lastError?.message}`);
}
