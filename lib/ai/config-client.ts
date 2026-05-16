// 客户端 AI 配置：localStorage 持久化 + 给 fetch 注入对应 headers。
// 安全：仅本地存储；通过 HTTP header（不入 URL/body）发到我们自己的 /api/* 后端，由后端去调真正的 LLM。

"use client";

const STORAGE_KEY = "trick-cards.ai-config.v2";
const LEGACY_STORAGE_KEY = "trick-cards.ai-config.v1";

export type LLMClientProvider = "openai" | "anthropic" | "gemini";

export type AIClientConfig = {
  llmProvider: LLMClientProvider;
  llmBaseUrl: string;
  llmApiKey: string;
  llmModel: string;
  tavilyApiKey: string;
};

export const EMPTY_AI_CONFIG: AIClientConfig = {
  llmProvider: "openai",
  llmBaseUrl: "",
  llmApiKey: "",
  llmModel: "",
  tavilyApiKey: ""
};

export const PROVIDER_DEFAULT_BASE_URLS: Record<LLMClientProvider, string> = {
  openai: "",
  anthropic: "https://api.anthropic.com",
  gemini: "https://generativelanguage.googleapis.com"
};

/**
 * provider=openai 时，根据 model 前缀启发式猜默认 base_url。
 * 仅当用户没手填 base_url 时使用。覆盖常见兼容服务。
 */
const OPENAI_MODEL_BASE_URL_HEURISTICS: Array<{
  match: (model: string) => boolean;
  baseUrl: string;
}> = [
  { match: (m) => m.startsWith("deepseek"), baseUrl: "https://api.deepseek.com" },
  { match: (m) => m.startsWith("moonshot") || m.startsWith("kimi"), baseUrl: "https://api.moonshot.cn" },
  { match: (m) => m.startsWith("qwen") || m.startsWith("qwq") || m.startsWith("dashscope"), baseUrl: "https://dashscope.aliyuncs.com/compatible-mode" },
  { match: (m) => m.startsWith("glm") || m.startsWith("zhipu") || m.startsWith("bigmodel"), baseUrl: "https://open.bigmodel.cn/api/paas" },
  { match: (m) => m.startsWith("llama") || m.includes("groq") || m.startsWith("mixtral"), baseUrl: "https://api.groq.com/openai" },
  { match: (m) => m.includes("/"), baseUrl: "https://openrouter.ai/api" }, // openrouter 模型必带斜杠
  { match: (m) => m.startsWith("gpt") || m.startsWith("o1") || m.startsWith("o3") || m.startsWith("text-") || m.startsWith("chatgpt"), baseUrl: "https://api.openai.com" }
];

function guessOpenAIBaseUrl(model: string): string {
  const m = model.trim().toLowerCase();
  if (!m) return "";
  for (const rule of OPENAI_MODEL_BASE_URL_HEURISTICS) {
    if (rule.match(m)) return rule.baseUrl;
  }
  return "";
}

function normalizeProviderClient(raw?: string): LLMClientProvider {
  const v = (raw ?? "").trim().toLowerCase();
  if (v === "anthropic" || v === "claude") return "anthropic";
  if (v === "gemini" || v === "google") return "gemini";
  return "openai";
}

/**
 * 计算实际生效的 base_url：
 *   1. 用户手填的 base_url 优先
 *   2. provider=anthropic / gemini 用各自默认
 *   3. provider=openai 时尝试按 model 名启发式猜（DeepSeek / 通义 / Kimi / Groq / OpenRouter / OpenAI 等）
 *   4. 都没命中返回 ""（→ isAIConfigComplete 仍 false）
 */
function effectiveBaseUrl(config: AIClientConfig): string {
  const trimmed = config.llmBaseUrl.trim();
  if (trimmed) return trimmed;
  const providerDefault = PROVIDER_DEFAULT_BASE_URLS[config.llmProvider] ?? "";
  if (providerDefault) return providerDefault;
  if (config.llmProvider === "openai") {
    return guessOpenAIBaseUrl(config.llmModel);
  }
  return "";
}

/** 公开版：UI 可以拿来在保存时落库，让 header 也带上猜出来的 base_url */
export function resolveEffectiveBaseUrl(config: AIClientConfig): string {
  return effectiveBaseUrl(config);
}

export function isAIConfigComplete(config: AIClientConfig): boolean {
  return Boolean(
    effectiveBaseUrl(config) &&
      config.llmApiKey.trim() &&
      config.llmModel.trim()
  );
}

export function loadAIConfig(): AIClientConfig {
  if (typeof window === "undefined") return EMPTY_AI_CONFIG;
  try {
    let raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // 迁移 v1（无 provider 字段）→ v2
      const legacy = window.localStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacy) {
        const parsedLegacy = JSON.parse(legacy) as Partial<AIClientConfig>;
        const migrated: AIClientConfig = {
          llmProvider: "openai",
          llmBaseUrl: parsedLegacy.llmBaseUrl?.trim() ?? "",
          llmApiKey: parsedLegacy.llmApiKey?.trim() ?? "",
          llmModel: parsedLegacy.llmModel?.trim() ?? "",
          tavilyApiKey: parsedLegacy.tavilyApiKey?.trim() ?? ""
        };
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
        window.localStorage.removeItem(LEGACY_STORAGE_KEY);
        return migrated;
      }
      return EMPTY_AI_CONFIG;
    }
    const parsed = JSON.parse(raw) as Partial<AIClientConfig>;
    return {
      llmProvider: normalizeProviderClient(parsed.llmProvider),
      llmBaseUrl: parsed.llmBaseUrl?.trim() ?? "",
      llmApiKey: parsed.llmApiKey?.trim() ?? "",
      llmModel: parsed.llmModel?.trim() ?? "",
      tavilyApiKey: parsed.tavilyApiKey?.trim() ?? ""
    };
  } catch {
    return EMPTY_AI_CONFIG;
  }
}

export function saveAIConfig(config: AIClientConfig) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  window.dispatchEvent(new CustomEvent("trick-cards:ai-config-change"));
}

export function clearAIConfig() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new CustomEvent("trick-cards:ai-config-change"));
}

/**
 * 把当前客户端配置变成 fetch headers，调任何 /api/* 时把这些 spread 进去即可。
 * 字段为空时不下发该 header（让后端 fallback 到 .env）。
 */
export function buildAIHeaders(
  config: AIClientConfig = loadAIConfig()
): Record<string, string> {
  const headers: Record<string, string> = {};
  if (config.llmProvider) headers["x-llm-provider"] = config.llmProvider;
  // base_url：用户手填优先，否则用启发式猜出来的
  const eff = effectiveBaseUrl(config);
  if (eff) headers["x-llm-base-url"] = eff;
  if (config.llmApiKey.trim())
    headers["x-llm-api-key"] = config.llmApiKey.trim();
  if (config.llmModel.trim()) headers["x-llm-model"] = config.llmModel.trim();
  if (config.tavilyApiKey.trim())
    headers["x-tavily-api-key"] = config.tavilyApiKey.trim();
  return headers;
}

/**
 * 在调 /api/* 时使用：自动附带客户端 AI 配置 headers，并默认 content-type=json。
 */
export function aiFetch(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<Response> {
  const aiHeaders = buildAIHeaders();
  const baseHeaders: Record<string, string> = {
    "content-type": "application/json"
  };
  const merged = new Headers({ ...baseHeaders, ...aiHeaders });
  if (init.headers) {
    new Headers(init.headers).forEach((value, key) => merged.set(key, value));
  }
  return fetch(input, { ...init, headers: merged });
}
