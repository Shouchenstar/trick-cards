// Agent 助手：主题 → arXiv + Semantic Scholar + Tavily 检索 → LLM 综合 → 大纲 + trick 候选

import { chatJSON, isLLMAvailable, type LLMOverride } from "./llm";
import {
  expandVenues,
  isTavilyAvailable,
  searchArxiv,
  searchBilibili,
  searchGitHub,
  searchIEEEXplore,
  searchOpenAlex,
  searchSemanticScholar,
  searchTavily,
  searchYouTube
} from "./search";
import type {
  AIChatMessage,
  AISearchResultPaper,
  AISearchResultWeb,
  AITrickCandidate,
  AgentRunResult
} from "./types";

// 根据选中的内容类型生成专门的 Tavily 搜索查询
function buildTavilyQueries(
  topic: string,
  contentTypes?: string[]
): { query: string; max: number }[] {
  if (!contentTypes?.length) {
    return [{ query: topic, max: 6 }];
  }

  const queries: { query: string; max: number }[] = [];
  const typeSet = new Set(contentTypes);

  // 视频类：B 站 + YouTube
  if (typeSet.has("video")) {
    queries.push({
      query: `${topic} 教程 视频 site:bilibili.com OR site:youtube.com`,
      max: 4
    });
  }
  // GitHub 仓库
  if (typeSet.has("github_repo")) {
    queries.push({
      query: `${topic} site:github.com`,
      max: 4
    });
  }
  // 博客 / 技术文档
  if (typeSet.has("blog") || typeSet.has("doc")) {
    queries.push({
      query: `${topic} 技术博客 教程 实践`,
      max: 4
    });
  }
  // 新闻 / 报告 / 课程 / 产品
  const otherTypes = ["news", "course", "report", "product"];
  if (otherTypes.some((t) => typeSet.has(t))) {
    const hints: string[] = [];
    if (typeSet.has("news")) hints.push("最新动态");
    if (typeSet.has("course")) hints.push("课程 教程");
    if (typeSet.has("report")) hints.push("行业报告 白皮书");
    if (typeSet.has("product")) hints.push("产品 工具");
    queries.push({
      query: `${topic} ${hints.join(" ")}`,
      max: 4
    });
  }
  // 如果只有 paper 类型，仍给一个通用 web 搜索作补充
  if (queries.length === 0) {
    queries.push({ query: topic, max: 4 });
  }
  return queries;
}

export async function runAgent(
  topic: string,
  options: {
    llmOverride?: LLMOverride;
    tavilyApiKey?: string;
    venues?: string[];
    contentTypes?: string[];
  } = {}
): Promise<AgentRunResult> {
  const tavilyOverride = { tavilyApiKey: options.tavilyApiKey };
  const wantsPapers =
    !options.contentTypes?.length || options.contentTypes.includes("paper");

  // 按内容类型构建多个 Tavily 搜索
  const tavilyQueries = buildTavilyQueries(topic, options.contentTypes);
  const tavilyAvail = isTavilyAvailable(tavilyOverride);

  const hasVenues = Boolean(options.venues?.length);
  const venueFullNames = hasVenues ? expandVenues(options.venues!) : [];

  // 检测中文输入 → 建议用户使用英文以获得更好搜索结果
  const hasChinese = /[一-鿿]/.test(topic);
  let englishTopic = topic;

  if (hasChinese && isLLMAvailable(options.llmOverride)) {
    // 有 LLM 时，用 LLM 翻译中文为英文
    try {
      const messages = [
        { role: "system" as const, content: "你是一个翻译助手。把用户输入的中文关键词翻译成英文学术关键词，只返回翻译结果，不要多余内容。" },
        { role: "user" as const, content: topic }
      ];
      const result = await chatJSON<{ translation: string }>(messages, { override: options.llmOverride, temperature: 0.3, maxTokens: 100 });
      if (result.translation) {
        englishTopic = result.translation.trim();
      }
    } catch {
      // 翻译失败，保留中文
    }
  } else if (hasChinese) {
    // 无 LLM 时，记录日志建议用户使用英文
    console.log("[Agent] 检测到中文输入，建议使用英文关键词以获得更准确的学术搜索结果");
  }

  const types = new Set(options.contentTypes ?? []);
  const freeWebSearches: Promise<AISearchResultWeb[]>[] = [];

  // GitHub 公开 API（免费，无需 Key）
  if (types.has("github_repo") || (!types.size)) {
    freeWebSearches.push(
      searchGitHub(hasChinese ? englishTopic : topic, { maxResults: 5 })
        .catch(() => [] as AISearchResultWeb[])
    );
  }
  // 视频平台公开搜索（免费，无需 Key）
  if (types.has("video") || (!types.size)) {
    // B 站用中文搜索效果好
    freeWebSearches.push(
      searchBilibili(topic, { maxResults: 5 }).catch(() => [] as AISearchResultWeb[])
    );
    // YouTube 用英文搜索效果好
    freeWebSearches.push(
      searchYouTube(hasChinese ? englishTopic : topic, { maxResults: 5 })
        .catch(() => [] as AISearchResultWeb[])
    );
  }
  // Tavily（可选增强——配置了 Key 才用，能搜到博客、新闻、课程等更多类型）
  const tavilySearches = tavilyAvail
    ? tavilyQueries.map((q) =>
        searchTavily(q.query, { maxResults: q.max, override: tavilyOverride })
          .catch(() => [] as AISearchResultWeb[])
      )
    : [];

  // arXiv 不支持 venue 过滤，但可以把会议全称加入搜索词提高相关度
  const arxivQuery = hasVenues
    ? `${englishTopic} ${venueFullNames.join(" ")}`
    : hasChinese ? `${topic} ${englishTopic}` : topic;

  // OpenAlex（主力）+ arXiv + S2（备用）+ IEEE Xplore + 免费 Web 搜索 并发
  const [arxivPapers, openAlexPapers, s2Papers, ieeePapers, ...allWebArrays] = await Promise.all([
    wantsPapers
      ? searchArxiv(arxivQuery, { maxResults: 8, sortBy: "relevance" })
          .catch(() => [] as AISearchResultPaper[])
      : Promise.resolve<AISearchResultPaper[]>([]),
    // OpenAlex：无严格限频，支持 venue 过滤，覆盖面最广
    wantsPapers
      ? searchOpenAlex(englishTopic, {
          maxResults: hasVenues ? 15 : 10,
          venues: options.venues
        }).catch(() => [] as AISearchResultPaper[])
      : Promise.resolve<AISearchResultPaper[]>([]),
    // S2 作为补充（可能被限频，所以只请求一次）
    wantsPapers
      ? searchSemanticScholar(englishTopic, {
          maxResults: 8,
          venues: options.venues
        }).catch(() => [] as AISearchResultPaper[])
      : Promise.resolve<AISearchResultPaper[]>([]),
    // IEEE Xplore：专门覆盖 IEEE 会议/期刊（ISSCC, JSSC, ISCA 等）
    wantsPapers && hasVenues
      ? searchIEEEXplore(englishTopic, {
          maxResults: 10,
          venues: options.venues
        }).catch(() => [] as AISearchResultPaper[])
      : Promise.resolve<AISearchResultPaper[]>([]),
    ...freeWebSearches,
    ...tavilySearches
  ]);

  console.log("[Agent] topic:", topic, "| english:", englishTopic,
    "| arxiv:", arxivPapers.length, "| openalex:", openAlexPapers.length,
    "| s2:", s2Papers.length, "| ieee:", ieeePapers.length,
    "| web:", allWebArrays.map(a => a.length));

  // 合并去重 web results
  const seenUrls = new Set<string>();
  const webResults: AISearchResultWeb[] = [];
  for (const arr of allWebArrays) {
    for (const item of arr) {
      if (item.url && !seenUrls.has(item.url)) {
        seenUrls.add(item.url);
        webResults.push(item);
      }
    }
  }

  // 合并去重（有 venue 时 IEEE + OpenAlex 优先，无 venue 时 arXiv 优先）
  const seen = new Set<string>();
  const papers: AISearchResultPaper[] = [];
  const hasVenueFilter = Boolean(options.venues?.length);
  const ordered = hasVenueFilter
    ? [...ieeePapers, ...openAlexPapers, ...s2Papers, ...arxivPapers]
    : [...arxivPapers, ...openAlexPapers, ...s2Papers, ...ieeePapers];
  for (const p of ordered) {
    const key = p.title.toLowerCase().replace(/\s+/g, " ").trim();
    if (!seen.has(key)) {
      seen.add(key);
      papers.push(p);
    }
  }

  let trickCandidates: AITrickCandidate[] = [];
  let outline: AgentRunResult["outline"] = [];

  if (
    isLLMAvailable(options.llmOverride) &&
    (papers.length || webResults.length)
  ) {
    try {
      const llm = await synthesize(
        topic,
        papers.slice(0, 5),
        webResults.slice(0, 5),
        options.llmOverride
      );
      outline = llm.outline;
      trickCandidates = llm.trickCandidates;
    } catch {
      // 失败时仅返回检索结果
    }
  }

  return {
    topic,
    papers,
    webResults,
    trickCandidates,
    outline,
    llmAvailable: isLLMAvailable(options.llmOverride),
    tavilyAvailable: isTavilyAvailable(tavilyOverride)
  };
}

type SynthesisResult = {
  outline: AgentRunResult["outline"];
  trickCandidates: AITrickCandidate[];
};

async function synthesize(
  topic: string,
  papers: AISearchResultPaper[],
  webResults: AISearchResultWeb[],
  override?: LLMOverride
): Promise<SynthesisResult> {
  const lines: string[] = [];
  papers.forEach((p, idx) => {
    lines.push(
      `论文${idx + 1}: ${p.title}\n摘要: ${p.abstract.slice(0, 600)}`
    );
  });
  webResults.forEach((w, idx) => {
    lines.push(
      `网页${idx + 1}: ${w.title}\n${(w.snippet ?? "").slice(0, 400)}`
    );
  });

  const messages: AIChatMessage[] = [
    {
      role: "system",
      content:
        "你是一个研究 Agent。基于主题和检索到的论文/网页，用中文输出严格 JSON：先给主题大纲（4-6 个分支），再提取 3-6 个可整理成 trick card 的候选。"
    },
    {
      role: "user",
      content: [
        `主题：${topic}`,
        "",
        "检索结果：",
        ...lines,
        "",
        "请严格按以下 JSON 输出：",
        '{',
        '  "outline": [',
        '    {"id": "o1", "title": "中文小标题", "description": "1-2 句中文说明"}',
        '  ],',
        '  "trickCandidates": [',
        '    {',
        '      "title": "中文 trick 名称",',
        '      "problem": "1-2 句中文",',
        '      "solution": "2-4 句中文",',
        '      "benefits": ["收益 1"],',
        '      "costs": ["成本 1"],',
        '      "applicableScenarios": ["场景 1"]',
        '    }',
        '  ]',
        '}'
      ].join("\n")
    }
  ];

  const data = await chatJSON<SynthesisResult>(messages, {
    temperature: 0.5,
    maxTokens: 2000,
    override
  });

  return {
    outline: Array.isArray(data.outline) ? data.outline : [],
    trickCandidates: Array.isArray(data.trickCandidates)
      ? data.trickCandidates
      : []
  };
}
