// Daily 推送：基于订阅主题，拉取最新 arXiv + 可选 LLM 中文摘要。

import { chatJSON, isLLMAvailable, type LLMOverride } from "./llm";
import { searchArxiv, searchSemanticScholar, searchIEEEXplore } from "./search";
import type {
  AIChatMessage,
  AISearchResultPaper,
  DailyDigest,
  DailyDigestItem
} from "./types";

export async function dailyDigest(
  topic: string,
  options: {
    maxItems?: number;
    llmOverride?: LLMOverride;
    venues?: string[];
  } = {}
): Promise<DailyDigest> {
  const max = Math.min(Math.max(options.maxItems ?? 5, 1), 12);
  const hasVenueFilter = Boolean(options.venues?.length);

  // 并发搜索：所有源同时发起，带超时保护
  const arxivPromise = searchArxiv(topic, { maxResults: max, sortBy: "submittedDate" })
    .catch(() => [] as AISearchResultPaper[]);
  const s2Promise = searchSemanticScholar(topic, {
    maxResults: max,
    venues: options.venues
  }).catch(() => [] as AISearchResultPaper[]);
  const ieeePromise = searchIEEEXplore(topic, {
    maxResults: max,
    venues: options.venues
  }).catch(() => [] as AISearchResultPaper[]);

  // 快速路径：arXiv 通常最快，先拿到结果就可以开始 LLM 摘要
  // 同时等待所有源完成后合并去重
  const [arxivPapers, s2Papers, ieeePapers] = await Promise.all([
    arxivPromise,
    s2Promise,
    ieeePromise
  ]);

  // 合并去重（按标题相似度去重）
  const seen = new Set<string>();
  const merged: AISearchResultPaper[] = [];
  // 优先级：IEEE Xplore > Semantic Scholar > arXiv（IEEE 论文质量高）
  const ordered = hasVenueFilter
    ? [...ieeePapers, ...s2Papers, ...arxivPapers]
    : [...arxivPapers, ...s2Papers, ...ieeePapers];
  for (const p of ordered) {
    const key = p.title.toLowerCase().replace(/\s+/g, " ").trim();
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(p);
    }
  }
  const papers = merged.slice(0, max);

  const items: DailyDigestItem[] = [];
  if (isLLMAvailable(options.llmOverride) && papers.length) {
    // 并行调用 LLM 摘要（带重试），整体速度从 N×LLM延迟 → ~1×LLM延迟
    const results = await Promise.allSettled(
      papers.map((paper) => summarizeOneWithRetry(paper, options.llmOverride))
    );
    for (let i = 0; i < papers.length; i++) {
      const result = results[i];
      if (result.status === "fulfilled") {
        items.push({ paper: papers[i], ...result.value });
      } else {
        items.push({ paper: papers[i] });
      }
    }
  } else {
    for (const paper of papers) {
      items.push({ paper });
    }
  }

  return {
    topic,
    generatedAt: new Date().toISOString(),
    items,
    llmAvailable: isLLMAvailable(options.llmOverride)
  };
}

type SummarizeOneResult = {
  summary: string;
  whyRead: string;
  insight: string;
  trickHint: string;
  benefits: string[];
  costs: string[];
};

async function summarizeOneWithRetry(
  paper: AISearchResultPaper,
  override?: LLMOverride,
  maxRetries = 2
): Promise<SummarizeOneResult> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await summarizeOne(paper, override);
    } catch (err) {
      lastErr = err;
      if (attempt < maxRetries - 1) {
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
  }
  throw lastErr;
}

async function summarizeOne(
  paper: AISearchResultPaper,
  override?: LLMOverride
): Promise<SummarizeOneResult> {
  const messages: AIChatMessage[] = [
    {
      role: "system",
      content:
        "你是技术 Daily 推送的写手。基于英文论文摘要，用中文输出严格 JSON。语气专业、简洁、避免空话。"
    },
    {
      role: "user",
      content: [
        `标题：${paper.title}`,
        `摘要：${paper.abstract}`,
        "",
        "请严格按以下 JSON 输出（所有字段必填，且不要返回任何额外字段或注释）：",
        '{',
        '  "summary": "2-3 句中文摘要，不超过 120 字，覆盖问题与方法",',
        '  "whyRead": "1 句中文回答这篇为什么值得读，不超过 40 字",',
        '  "insight": "1 句中文，论文最核心的洞见 / 关键发现，不超过 50 字",',
        '  "trickHint": "1 句中文，告诉读者可以从中提炼什么 trick，可直接落到工程，不超过 60 字",',
        '  "benefits": ["该 trick 落地后的具体收益，2-4 条短语，每条不超过 12 字"],',
        '  "costs": ["该 trick 的代价 / 局限，1-3 条短语，每条不超过 12 字"]',
        '}'
      ].join("\n")
    }
  ];

  const data = await chatJSON<Partial<SummarizeOneResult>>(messages, {
    temperature: 0.4,
    maxTokens: 800,
    override
  });
  return {
    summary: data.summary ?? "",
    whyRead: data.whyRead ?? "",
    insight: data.insight ?? "",
    trickHint: data.trickHint ?? "",
    benefits: Array.isArray(data.benefits) ? data.benefits : [],
    costs: Array.isArray(data.costs) ? data.costs : []
  };
}
