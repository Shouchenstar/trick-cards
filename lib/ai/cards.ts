// 卡片字段 AI 补全：基于已有标题/描述/源材料，自动填充 problem/solution/...

import { chatJSON, type LLMOverride } from "./llm";
import type { AICardCompletion, AIChatMessage } from "./types";

export type CompleteCardInput = {
  title: string;
  description?: string;
  domain?: string;
  collection?: string;
  tags?: string[];
  source?: {
    title?: string;
    url?: string;
    abstract?: string;
  };
};

export async function completeCard(
  input: CompleteCardInput,
  options: { llmOverride?: LLMOverride } = {}
): Promise<AICardCompletion> {
  const messages: AIChatMessage[] = [
    {
      role: "system",
      content:
        "你是帮助技术研究者结构化整理 trick 的助手。请基于用户提供的卡片信息，用中文输出严格 JSON。所有字段都必须具体、可操作；如果原始信息不足，可以基于常识合理推断，但不要编造数字或论文。"
    },
    {
      role: "user",
      content: [
        `标题：${input.title}`,
        input.description ? `当前描述：${input.description}` : "",
        input.domain ? `领域：${input.domain}` : "",
        input.collection ? `专栏：${input.collection}` : "",
        input.tags?.length ? `已有标签：${input.tags.join(", ")}` : "",
        input.source?.title ? `来源标题：${input.source.title}` : "",
        input.source?.url ? `来源链接：${input.source.url}` : "",
        input.source?.abstract ? `来源摘要：${input.source.abstract}` : "",
        "",
        "请严格按以下 JSON 输出：",
        '{',
        '  "problem": "2-3 句中文：这个 trick 试图解决什么问题",',
        '  "solution": "3-6 句中文：核心做法、关键步骤、与已有方法的区别",',
        '  "benefits": ["3-5 条具体收益，每条 8-25 字"],',
        '  "costs": ["2-4 条成本/代价"],',
        '  "tradeoffs": ["1-3 条权衡点"],',
        '  "applicableScenarios": ["2-4 个适用场景"],',
        '  "unsuitableScenarios": ["1-3 个不适用场景"],',
        '  "tags": ["3-6 个标签，可中可英"]',
        '}'
      ]
        .filter(Boolean)
        .join("\n")
    }
  ];

  const data = await chatJSON<AICardCompletion>(messages, {
    temperature: 0.4,
    maxTokens: 1600,
    override: options.llmOverride
  });

  return {
    problem: data.problem ?? "",
    solution: data.solution ?? "",
    benefits: ensureArray(data.benefits),
    costs: ensureArray(data.costs),
    tradeoffs: ensureArray(data.tradeoffs),
    applicableScenarios: ensureArray(data.applicableScenarios),
    unsuitableScenarios: ensureArray(data.unsuitableScenarios),
    tags: ensureArray(data.tags)
  };
}

function ensureArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter(Boolean);
}
