// 服务端：从请求 header 读取用户在前端填的 API key（覆盖 .env）。
// 安全要点：
//  - 仅在单次请求内使用，不写入磁盘 / 数据库 / 日志。
//  - HTTP header 通过 HTTPS 端到端加密；本地 dev 是 localhost。
//  - 客户端把 key 存在 localStorage（同源策略保护）。

import { normalizeProvider, type LLMOverride } from "./llm";

export type AIRequestOverrides = {
  llm?: LLMOverride;
  tavilyApiKey?: string;
};

export function readAIOverrides(headers: Headers): AIRequestOverrides {
  const providerRaw = headers.get("x-llm-provider")?.trim() || undefined;
  const baseUrl = headers.get("x-llm-base-url")?.trim() || undefined;
  const apiKey = headers.get("x-llm-api-key")?.trim() || undefined;
  const model = headers.get("x-llm-model")?.trim() || undefined;
  const tavilyApiKey =
    headers.get("x-tavily-api-key")?.trim() || undefined;

  const provider = providerRaw ? normalizeProvider(providerRaw) : undefined;

  const llm =
    provider || baseUrl || apiKey || model
      ? { provider, baseUrl, apiKey, model }
      : undefined;

  return { llm, tavilyApiKey };
}
