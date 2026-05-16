/**
 * 全局 Agent 缓存 —— 在页面切换时保留 Agent 运行状态和结果。
 * 使用模块级变量，不依赖 React 组件生命周期。
 */

import type { AgentRunResult } from "@/lib/ai/types";

type AgentNodeType =
  | "topic"
  | "paper"
  | "blog"
  | "github_repo"
  | "doc"
  | "video"
  | "news"
  | "course"
  | "product"
  | "report"
  | "trick_card"
  | "project";

export type AgentCacheState = {
  input: string;
  venues: string;
  selectedTypes: AgentNodeType[];
  running: boolean;
  result: AgentRunResult | null;
  error: string | null;
  llmAvailable: boolean | null;
  tavilyAvailable: boolean | null;
  /** 正在运行的 fetch promise，切换页面后可继续等待 */
  pendingFetch: Promise<AgentRunResult> | null;
};

const defaultTypes: AgentNodeType[] = ["paper", "github_repo", "blog", "video"];

let cache: AgentCacheState = {
  input: "",
  venues: "",
  selectedTypes: defaultTypes,
  running: false,
  result: null,
  error: null,
  llmAvailable: null,
  tavilyAvailable: null,
  pendingFetch: null
};

export function getAgentCache(): AgentCacheState {
  return cache;
}

export function setAgentCache(patch: Partial<AgentCacheState>) {
  cache = { ...cache, ...patch };
}

export function resetAgentCache() {
  cache = {
    input: "",
    venues: "",
    selectedTypes: defaultTypes,
    running: false,
    result: null,
    error: null,
    llmAvailable: null,
    tavilyAvailable: null,
    pendingFetch: null
  };
}
