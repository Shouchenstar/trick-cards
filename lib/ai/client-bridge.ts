// 客户端直连桥接：跳过 API route，直接从浏览器调用 lib 函数。
// 适用于 Tauri 桌面端（static export，无 Node.js 服务端）。
// 也兼容 next dev（此时 API route 仍可用，但组件改为走这里）。

"use client";

import { loadAIConfig, resolveEffectiveBaseUrl } from "./config-client";
import type { LLMOverride } from "./llm";

/** 从 localStorage 读取用户 AI 配置，转为 LLMOverride */
function getOverrides(): { llm?: LLMOverride; tavilyApiKey?: string } {
  const config = loadAIConfig();
  const baseUrl = resolveEffectiveBaseUrl(config);
  const llm: LLMOverride | undefined =
    baseUrl && config.llmApiKey.trim() && config.llmModel.trim()
      ? {
          provider: config.llmProvider as LLMOverride["provider"],
          baseUrl,
          apiKey: config.llmApiKey.trim(),
          model: config.llmModel.trim()
        }
      : undefined;
  const tavilyApiKey = config.tavilyApiKey.trim() || undefined;
  return { llm, tavilyApiKey };
}

// ---- Agent ----

export async function callAgent(
  topic: string,
  options: { venues?: string[]; contentTypes?: string[] } = {}
) {
  const { runAgent } = await import("./agent");
  const { llm, tavilyApiKey } = getOverrides();
  return runAgent(topic, {
    llmOverride: llm,
    tavilyApiKey,
    venues: options.venues,
    contentTypes: options.contentTypes
  });
}

// ---- Daily Digest ----

export async function callDailyDigest(
  topic: string,
  options: { maxItems?: number; venues?: string[] } = {}
) {
  const { dailyDigest } = await import("./daily");
  const { llm } = getOverrides();
  return dailyDigest(topic, {
    maxItems: options.maxItems,
    llmOverride: llm,
    venues: options.venues
  });
}

// ---- Paper Import ----

export async function callImportPaper(input: string) {
  const { importPaper } = await import("./papers");
  const { llm } = getOverrides();
  return importPaper(input, { llmOverride: llm });
}

// ---- Card AI Complete ----

export async function callCompleteCard(params: {
  title: string;
  description?: string;
  domain?: string;
  collection?: string;
  tags?: string[];
  source?: { title?: string; url?: string; abstract?: string };
}) {
  const { completeCard } = await import("./cards");
  const { llm } = getOverrides();
  return completeCard(params, { llmOverride: llm });
}

// ---- LLM Status ----

export async function callLLMStatus() {
  const { isLLMAvailable, chat } = await import("./llm");
  const { llm, tavilyApiKey } = getOverrides();

  // 1. 字段完整性检查
  const configured = isLLMAvailable(llm);
  if (!configured) {
    return {
      available: false,
      model: llm?.model ?? null,
      baseUrl: llm?.baseUrl ?? null,
      tavilyAvailable: Boolean(tavilyApiKey),
      source: llm?.apiKey ? "client" : "none",
      error: "未填完整：base_url / api_key / model"
    };
  }

  // 2. 真发一个最小请求验证 key/base_url/model 是否真的可用
  try {
    await chat(
      [{ role: "user", content: "ping" }],
      { override: llm, maxTokens: 1, temperature: 0 }
    );
    return {
      available: true,
      model: llm?.model ?? null,
      baseUrl: llm?.baseUrl ?? null,
      tavilyAvailable: Boolean(tavilyApiKey),
      source: llm?.apiKey ? "client" : "none",
      error: null
    };
  } catch (err) {
    return {
      available: false,
      model: llm?.model ?? null,
      baseUrl: llm?.baseUrl ?? null,
      tavilyAvailable: Boolean(tavilyApiKey),
      source: llm?.apiKey ? "client" : "none",
      error: (err as Error).message ?? "调用失败"
    };
  }
}

// ---- LLM Chat ----

export async function callChat(
  messages: { role: string; content: string }[],
  options: { temperature?: number; maxTokens?: number } = {}
) {
  const { chat } = await import("./llm");
  const { llm } = getOverrides();
  return chat(messages as Parameters<typeof chat>[0], {
    temperature: options.temperature,
    maxTokens: options.maxTokens,
    override: llm
  });
}
