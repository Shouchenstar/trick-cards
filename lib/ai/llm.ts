// LLM 客户端：支持市面上所有主流 LLM API。
//
// 通过 `provider` 字段路由到三种协议适配器：
//   - "openai"    → OpenAI 兼容协议（OpenAI / DeepSeek / Kimi / 智谱 / 通义 / Groq / Together /
//                    Fireworks / SiliconFlow / OpenRouter / Azure OpenAI / Ollama / vLLM / 零一万物 /
//                    MiniMax / Mistral / Stepfun 等绝大多数）
//   - "anthropic" → Anthropic Messages API（Claude 全系）
//   - "gemini"    → Google Gemini Generative Language API（Gemini 1.5 / 2.x 全系）
//
// 仅在服务端使用（API routes / server actions）。

import type { AIChatMessage } from "./types";
import { safeFetch } from "../safeFetch";

const DEFAULT_TIMEOUT_MS = 120_000;

export type LLMProvider = "openai" | "anthropic" | "gemini";

export type LLMConfig = {
  provider: LLMProvider;
  baseUrl: string;
  apiKey: string;
  model: string;
};

export type LLMOverride = Partial<LLMConfig>;

const DEFAULT_BASE_URLS: Record<LLMProvider, string> = {
  openai: "",
  anthropic: "https://api.anthropic.com",
  gemini: "https://generativelanguage.googleapis.com"
};

export class LLMError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = "LLMError";
    this.status = status;
  }
}

export class LLMNotConfiguredError extends LLMError {
  constructor() {
    super(
      "LLM 未配置：请在「AI 设置」里填 provider / base_url / api_key / model（或在 .env.local 配 LLM_*）"
    );
    this.name = "LLMNotConfiguredError";
  }
}

export function normalizeProvider(raw?: string | null): LLMProvider {
  const v = (raw ?? "").trim().toLowerCase();
  if (v === "anthropic" || v === "claude") return "anthropic";
  if (v === "gemini" || v === "google") return "gemini";
  return "openai";
}

function resolvedBaseUrl(provider: LLMProvider, base?: string): string {
  const trimmed = (base ?? "").trim();
  if (trimmed) return trimmed.replace(/\/+$/, "");
  return DEFAULT_BASE_URLS[provider];
}

export function isLLMAvailable(override?: LLMOverride): boolean {
  const provider = normalizeProvider(
    override?.provider ?? process.env.LLM_PROVIDER
  );
  const baseUrl = resolvedBaseUrl(
    provider,
    override?.baseUrl ?? process.env.LLM_BASE_URL ?? undefined
  );
  const apiKey = override?.apiKey || process.env.LLM_API_KEY;
  const model = override?.model || process.env.LLM_MODEL;
  return Boolean(baseUrl && apiKey && model);
}

export function getLLMConfig(override?: LLMOverride): LLMConfig {
  const provider = normalizeProvider(
    override?.provider ?? process.env.LLM_PROVIDER
  );
  const baseUrl = resolvedBaseUrl(
    provider,
    override?.baseUrl ?? process.env.LLM_BASE_URL ?? undefined
  );
  const apiKey = (override?.apiKey ?? process.env.LLM_API_KEY ?? "").trim();
  const model = (override?.model ?? process.env.LLM_MODEL ?? "").trim();
  if (!baseUrl || !apiKey || !model) {
    throw new LLMNotConfiguredError();
  }
  return { provider, baseUrl, apiKey, model };
}

export type ChatOptions = {
  temperature?: number;
  maxTokens?: number;
  responseFormat?: "text" | "json_object";
  signal?: AbortSignal;
  override?: LLMOverride;
};

function makeAbortController(opts: ChatOptions): {
  signal: AbortSignal;
  cleanup: () => void;
} {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  if (opts.signal) {
    opts.signal.addEventListener("abort", () => controller.abort(), {
      once: true
    });
  }
  return {
    signal: controller.signal,
    cleanup: () => clearTimeout(timeout)
  };
}

export async function chat(
  messages: AIChatMessage[],
  opts: ChatOptions = {}
): Promise<string> {
  const config = getLLMConfig(opts.override);
  switch (config.provider) {
    case "anthropic":
      return chatAnthropic(messages, config, opts);
    case "gemini":
      return chatGemini(messages, config, opts);
    case "openai":
    default:
      return chatOpenAI(messages, config, opts);
  }
}

export async function chatJSON<T>(
  messages: AIChatMessage[],
  opts: ChatOptions = {}
): Promise<T> {
  const text = await chat(messages, {
    ...opts,
    responseFormat: opts.responseFormat ?? "json_object"
  });
  const cleaned = extractJSONBlock(text);
  // 1. 直接解析
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // 2. 尝试本地修复（转义字符串值内未转义的引号、移除尾随逗号等）
    try {
      const repaired = repairJSON(cleaned);
      return JSON.parse(repaired) as T;
    } catch {
      // 3. 让 LLM 自己重写为合法 JSON
      try {
        const reformatted = await chat(
          [
            {
              role: "system",
              content:
                "你是 JSON 修复器。把用户给的字符串改写成严格合法的 JSON（不要任何解释、不要 markdown 代码块）。字符串里的所有内嵌双引号必须用 \\\" 转义。保持原始字段和语义，仅修复格式。"
            },
            { role: "user", content: cleaned }
          ],
          { ...opts, responseFormat: "json_object", temperature: 0 }
        );
        const cleaned2 = extractJSONBlock(reformatted);
        return JSON.parse(cleaned2) as T;
      } catch {
        throw new LLMError(
          `LLM 返回的 JSON 无法解析（前 200 字）：${cleaned.slice(0, 200)}`
        );
      }
    }
  }
}

// ============== OpenAI 兼容协议 ==============

async function chatOpenAI(
  messages: AIChatMessage[],
  config: LLMConfig,
  opts: ChatOptions
): Promise<string> {
  const url = buildChatCompletionsUrl(config.baseUrl);
  const body: Record<string, unknown> = {
    model: config.model,
    messages,
    temperature: opts.temperature ?? 0.4,
    max_tokens: opts.maxTokens ?? 2048,
    stream: false
  };
  if (opts.responseFormat === "json_object") {
    body.response_format = { type: "json_object" };
  }

  const { signal, cleanup } = makeAbortController(opts);
  let response: Response;
  try {
    response = await safeFetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${config.apiKey}`
      },
      body: JSON.stringify(body),
      signal
    });
  } catch (err) {
    cleanup();
    throw new LLMError(`OpenAI 兼容接口网络错误：${(err as Error).message}`);
  }
  cleanup();

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new LLMError(
      `OpenAI 兼容接口调用失败 (${response.status})：${text.slice(0, 280)}`,
      response.status
    );
  }
  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return data.choices?.[0]?.message?.content?.trim() ?? "";
}

function buildChatCompletionsUrl(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/+$/, "");
  if (/\/chat\/completions$/.test(trimmed)) return trimmed;
  if (/\/v\d+$/.test(trimmed)) return `${trimmed}/chat/completions`;
  return `${trimmed}/v1/chat/completions`;
}

// ============== Anthropic Messages ==============

async function chatAnthropic(
  messages: AIChatMessage[],
  config: LLMConfig,
  opts: ChatOptions
): Promise<string> {
  const url = `${config.baseUrl.replace(/\/+$/, "")}/v1/messages`;

  const systemParts = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .filter(Boolean);
  const conversation = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content
    }));

  const body: Record<string, unknown> = {
    model: config.model,
    max_tokens: opts.maxTokens ?? 2048,
    temperature: opts.temperature ?? 0.4,
    messages: conversation
  };
  if (systemParts.length) body.system = systemParts.join("\n\n");

  const { signal, cleanup } = makeAbortController(opts);
  let response: Response;
  try {
    response = await safeFetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": config.apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify(body),
      signal
    });
  } catch (err) {
    cleanup();
    throw new LLMError(`Anthropic 网络错误：${(err as Error).message}`);
  }
  cleanup();

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new LLMError(
      `Anthropic 调用失败 (${response.status})：${text.slice(0, 280)}`,
      response.status
    );
  }
  const data = (await response.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };
  const text =
    data.content
      ?.filter((c) => c.type === "text" && typeof c.text === "string")
      .map((c) => c.text!)
      .join("") ?? "";
  return text.trim();
}

// ============== Google Gemini ==============

async function chatGemini(
  messages: AIChatMessage[],
  config: LLMConfig,
  opts: ChatOptions
): Promise<string> {
  const base = config.baseUrl.replace(/\/+$/, "");
  const url = `${base}/v1beta/models/${encodeURIComponent(
    config.model
  )}:generateContent?key=${encodeURIComponent(config.apiKey)}`;

  const systemParts = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .filter(Boolean);
  const contents = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }]
    }));

  const generationConfig: Record<string, unknown> = {
    temperature: opts.temperature ?? 0.4,
    maxOutputTokens: opts.maxTokens ?? 2048
  };
  if (opts.responseFormat === "json_object") {
    generationConfig.responseMimeType = "application/json";
  }

  const body: Record<string, unknown> = {
    contents,
    generationConfig
  };
  if (systemParts.length) {
    body.systemInstruction = { parts: [{ text: systemParts.join("\n\n") }] };
  }

  const { signal, cleanup } = makeAbortController(opts);
  let response: Response;
  try {
    response = await safeFetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal
    });
  } catch (err) {
    cleanup();
    throw new LLMError(`Gemini 网络错误：${(err as Error).message}`);
  }
  cleanup();

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new LLMError(
      `Gemini 调用失败 (${response.status})：${text.slice(0, 280)}`,
      response.status
    );
  }
  const data = (await response.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
  };
  const text =
    data.candidates?.[0]?.content?.parts
      ?.map((p) => p.text ?? "")
      .filter(Boolean)
      .join("") ?? "";
  return text.trim();
}

// ============== 工具函数 ==============

/**
 * 修复 LLM 返回的常见非法 JSON：
 * 1. 中文/全角双引号 → ASCII 双引号（仅作为结构性引号时）— 简化为整体替换
 * 2. 字符串值内出现未转义的 ASCII 双引号 → 自动加 \
 * 3. 尾随逗号
 *
 * 算法：状态机逐字符扫描。当处于字符串内部时，遇到 `"`：
 *   - 若紧跟 `,` `}` `]` `:` 或换行/EOF（允许中间空白），视为字符串结束
 *   - 否则视为内嵌引号，自动转义
 */
function repairJSON(input: string): string {
  // 先把成对中文双引号替换为转义的 ASCII 引号（避免后续状态机误判）
  let s = input
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'");

  const out: string[] = [];
  let i = 0;
  let inString = false;
  let escape = false;

  while (i < s.length) {
    const c = s[i];

    if (!inString) {
      if (c === '"') {
        inString = true;
        out.push(c);
        i++;
        continue;
      }
      // 移除尾随逗号: , 后跟空白再跟 } 或 ]
      if (c === ",") {
        let j = i + 1;
        while (j < s.length && /\s/.test(s[j])) j++;
        if (s[j] === "}" || s[j] === "]") {
          i = j;
          continue;
        }
      }
      out.push(c);
      i++;
      continue;
    }

    // inString === true
    if (escape) {
      out.push(c);
      escape = false;
      i++;
      continue;
    }
    if (c === "\\") {
      out.push(c);
      escape = true;
      i++;
      continue;
    }
    if (c === '"') {
      // 判断是真结尾还是内嵌引号
      let j = i + 1;
      while (j < s.length && (s[j] === " " || s[j] === "\t")) j++;
      const next = s[j];
      if (
        next === "," ||
        next === "}" ||
        next === "]" ||
        next === ":" ||
        next === "\n" ||
        next === "\r" ||
        next === undefined
      ) {
        inString = false;
        out.push(c);
        i++;
      } else {
        // 内嵌引号 → 转义
        out.push("\\");
        out.push(c);
        i++;
      }
      continue;
    }
    out.push(c);
    i++;
  }

  return out.join("");
}

function extractJSONBlock(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith("```")) {
    const match = trimmed.match(/```(?:json)?\n?([\s\S]*?)\n?```/);
    if (match) return match[1].trim();
  }
  // 兜底：找第一个 { ... } 块
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) {
    return trimmed.slice(first, last + 1);
  }
  return trimmed;
}
