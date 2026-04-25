import type { z } from "zod";
import type { Config } from "./config.js";
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

function resolveModel(config: Config, role: PersonaRole): string {
  return config.models[role] ?? config.defaultModel;
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

async function fetchCompletion(
  config: Config,
  model: string,
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  const url = `${config.provider.baseUrl}/v1/chat/completions`;
  const body = {
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    stream: false,
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(config.timeoutMs),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`HTTP ${response.status}: ${text}`);
  }

  const json = await response.json() as {
    choices?: { message?: { content?: string } }[];
  };

  const content = json.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("Empty response from LLM");
  }

  return content;
}

export async function callLlm(opts: LlmCallOptions): Promise<string> {
  const model = resolveModel(opts.config, opts.role);
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= opts.config.retries; attempt++) {
    if (opts.config.delayMs > 0) {
      await delay(opts.config.delayMs);
    }

    const start = Date.now();
    try {
      const response = await fetchCompletion(opts.config, model, opts.systemPrompt, opts.userPrompt);
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

      return response;
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

function stripCodeFences(text: string): string {
  const fenced = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (fenced) return fenced[1].trim();
  return text.trim();
}

export async function callLlmJson<T>(opts: LlmJsonCallOptions<T>): Promise<T> {
  const model = resolveModel(opts.config, opts.role);
  let lastError: Error | null = null;
  const systemPrompt = opts.systemPrompt + "\n\nRespond with valid JSON only, no markdown fences.";

  for (let attempt = 1; attempt <= opts.config.retries; attempt++) {
    if (opts.config.delayMs > 0) {
      await delay(opts.config.delayMs);
    }

    const start = Date.now();
    try {
      const raw = await fetchCompletion(opts.config, model, systemPrompt, opts.userPrompt);
      const durationMs = Date.now() - start;
      const cleaned = stripCodeFences(raw);
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
