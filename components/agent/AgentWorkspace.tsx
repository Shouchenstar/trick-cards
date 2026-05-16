"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Bookmark,
  Bot,
  CheckCircle2,
  CircleDot,
  Compass,
  ExternalLink,
  FileText,
  Film,
  GitBranch,
  Github,
  Globe,
  Layers,
  Lightbulb,
  ListChecks,
  Loader2,
  Newspaper,
  Package,
  Play,
  Plus,
  Radar,
  RefreshCcw,
  Sparkles,
  Workflow
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { TopBar } from "@/components/layout/TopBar";
import { useTrickStore } from "@/lib/store/TrickStore";
import { Collection, TrickCard } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  isAIConfigComplete,
  loadAIConfig
} from "@/lib/ai/config-client";
import { callAgent } from "@/lib/ai/client-bridge";
import type { AgentRunResult } from "@/lib/ai/types";
import { getAgentCache, setAgentCache } from "@/lib/store/agentCache";

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

type AgentEdgeType =
  | "cites"
  | "references"
  | "implements"
  | "explains"
  | "extends"
  | "compares_with"
  | "alternative_to"
  | "same_topic"
  | "same_method"
  | "used_by"
  | "derived_from"
  | "summarizes"
  | "mentions";

type AgentCluster = {
  id: string;
  label: string;
  description: string;
};

type AgentNode = {
  id: string;
  type: AgentNodeType;
  title: string;
  subtitle?: string;
  source?: string;
  url?: string;
  cluster: string;
  recommendation?: string;
  highlights?: string[];
};

type AgentEdge = {
  from: string;
  to: string;
  type: AgentEdgeType;
};

type AgentCandidate = {
  id: string;
  title: string;
  problem: string;
  insight: string;
  benefits: string[];
  costs: string[];
  tradeoffs: string[];
  fromNodeId: string;
  suggestedCollectionId?: string;
};

type AgentResult = {
  topic: string;
  contentTypes: AgentNodeType[];
  clusters: AgentCluster[];
  nodes: AgentNode[];
  edges: AgentEdge[];
  candidates: AgentCandidate[];
};

const contentTypeMeta: Record<
  AgentNodeType,
  { label: string; icon: LucideIcon }
> = {
  topic: { label: "主题", icon: Compass },
  paper: { label: "论文", icon: FileText },
  blog: { label: "技术博客", icon: Newspaper },
  github_repo: { label: "GitHub 仓库", icon: Github },
  doc: { label: "技术文档", icon: ListChecks },
  video: { label: "视频", icon: Film },
  news: { label: "新闻", icon: Newspaper },
  course: { label: "课程", icon: Bookmark },
  product: { label: "产品页面", icon: Package },
  report: { label: "报告", icon: FileText },
  trick_card: { label: "Trick 卡片", icon: Sparkles },
  project: { label: "项目", icon: Workflow }
};

const edgeMeta: Record<AgentEdgeType, { label: string; color: string }> = {
  cites: { label: "引用", color: "#94A3B8" },
  references: { label: "参考", color: "#94A3B8" },
  implements: { label: "实现", color: "#16A34A" },
  explains: { label: "解释", color: "#0EA5E9" },
  extends: { label: "拓展", color: "#7C3AED" },
  compares_with: { label: "与之对比", color: "#F97316" },
  alternative_to: { label: "替代方案", color: "#F97316" },
  same_topic: { label: "同主题", color: "#1E40AF" },
  same_method: { label: "同方法", color: "#0891B2" },
  used_by: { label: "被使用", color: "#16A34A" },
  derived_from: { label: "衍生自", color: "#9333EA" },
  summarizes: { label: "总结", color: "#0EA5E9" },
  mentions: { label: "提及", color: "#94A3B8" }
};

const agentSteps = [
  { key: "parse", label: "解析输入" },
  { key: "classify", label: "识别内容类型" },
  { key: "search", label: "搜索相关知识源" },
  { key: "dedupe", label: "去重与排序" },
  { key: "relate", label: "判断知识源关系" },
  { key: "graph", label: "生成知识图谱" },
  { key: "path", label: "推荐探索路径" },
  { key: "tricks", label: "提取 Trick 候选" }
] as const;

type StepKey = (typeof agentSteps)[number]["key"];
type StepStatus = "pending" | "running" | "done";

const defaultContentTypes: AgentNodeType[] = [
  "paper",
  "github_repo",
  "video"
];

const allContentTypes: AgentNodeType[] = [
  "paper",
  "github_repo",
  "video"
];

const mockResult: AgentResult = {
  topic: "Multimodal RAG over enterprise documents",
  contentTypes: defaultContentTypes,
  clusters: [
    {
      id: "method-fusion",
      label: "Fusion Retrieval 方法簇",
      description: "多模态查询路由与混合召回策略的核心论文与开源实现。"
    },
    {
      id: "doc-parsing",
      label: "Document Parsing 工程",
      description: "OCR、版面理解与结构化抽取相关的工程实践。"
    },
    {
      id: "evaluation",
      label: "Evaluation 与基准",
      description: "多模态 RAG 评估、错误分析与对比基准。"
    },
    {
      id: "applications",
      label: "Applications 与产品",
      description: "把多模态 RAG 用于企业知识库与运维问答的真实案例。"
    }
  ],
  nodes: [
    {
      id: "topic-root",
      type: "topic",
      title: "Multimodal RAG",
      subtitle: "聚焦企业文档场景的混合召回",
      cluster: "method-fusion"
    },
    {
      id: "paper-fusion",
      type: "paper",
      title: "Fusion Retrieval for Multimodal RAG",
      subtitle: "ACL 2025 · 提出 query routing + 模态加权",
      source: "arxiv",
      cluster: "method-fusion",
      recommendation: "思路最贴近你输入的目标场景。",
      highlights: ["query routing", "modal weighting", "hybrid recall"]
    },
    {
      id: "repo-fusion",
      type: "github_repo",
      title: "open-fusion-rag",
      subtitle: "Python · 1.8k stars · 基于 LangChain",
      source: "github.com",
      cluster: "method-fusion",
      recommendation: "可直接跑通的最简实现。",
      highlights: ["LangChain", "FAISS", "CLIP"]
    },
    {
      id: "blog-fusion",
      type: "blog",
      title: "How we shipped a multimodal copilot",
      subtitle: "Engineering blog · 2025-09",
      source: "blog.example.com",
      cluster: "method-fusion"
    },
    {
      id: "paper-layout",
      type: "paper",
      title: "Layout-aware Document Parsing",
      subtitle: "EMNLP 2024 · 表格 / 脚注 / 多栏处理",
      source: "arxiv",
      cluster: "doc-parsing",
      recommendation: "决定上游解析质量的关键。",
      highlights: ["layout", "OCR", "table"]
    },
    {
      id: "repo-layout",
      type: "github_repo",
      title: "doc-layout-toolkit",
      subtitle: "Python · 2.4k stars",
      source: "github.com",
      cluster: "doc-parsing"
    },
    {
      id: "doc-fastdoc",
      type: "doc",
      title: "FastDoc Parsing Guide",
      subtitle: "官方文档 · 解析最佳实践",
      source: "fastdoc.io",
      cluster: "doc-parsing"
    },
    {
      id: "paper-eval",
      type: "paper",
      title: "Benchmarking Multimodal RAG",
      subtitle: "NeurIPS 2025 Bench Track",
      source: "openreview",
      cluster: "evaluation",
      recommendation: "建立线上回归评估时优先参考。"
    },
    {
      id: "video-eval",
      type: "video",
      title: "Stanford CS25 · Multimodal RAG",
      subtitle: "讲座视频 · 1h 18m",
      source: "youtube",
      cluster: "evaluation"
    },
    {
      id: "report-eval",
      type: "report",
      title: "Industry Report: Doc AI 2026",
      subtitle: "Gartner-style 报告",
      source: "report.example.com",
      cluster: "evaluation"
    },
    {
      id: "product-ops",
      type: "product",
      title: "Ops Copilot",
      subtitle: "企业运维 copilot · 内置多模态 RAG",
      source: "opscopilot.ai",
      cluster: "applications"
    },
    {
      id: "news-launch",
      type: "news",
      title: "新一代 Doc AI 平台发布",
      subtitle: "新闻 · 2026-03",
      source: "techpress",
      cluster: "applications"
    },
    {
      id: "blog-case",
      type: "blog",
      title: "Case study: support QA at 50k tickets/mo",
      subtitle: "企业用户落地经验",
      source: "blog.example.com",
      cluster: "applications"
    }
  ],
  edges: [
    { from: "topic-root", to: "paper-fusion", type: "same_topic" },
    { from: "topic-root", to: "paper-layout", type: "same_topic" },
    { from: "topic-root", to: "paper-eval", type: "same_topic" },
    { from: "paper-fusion", to: "repo-fusion", type: "implements" },
    { from: "paper-fusion", to: "blog-fusion", type: "explains" },
    { from: "paper-fusion", to: "paper-layout", type: "references" },
    { from: "paper-layout", to: "repo-layout", type: "implements" },
    { from: "paper-layout", to: "doc-fastdoc", type: "summarizes" },
    { from: "paper-eval", to: "video-eval", type: "explains" },
    { from: "paper-eval", to: "report-eval", type: "summarizes" },
    { from: "repo-fusion", to: "product-ops", type: "used_by" },
    { from: "blog-case", to: "product-ops", type: "mentions" },
    { from: "news-launch", to: "product-ops", type: "mentions" },
    { from: "paper-fusion", to: "paper-eval", type: "compares_with" }
  ],
  candidates: [
    {
      id: "cand-routing",
      title: "Query Routing for Multimodal RAG",
      problem: "默认全模态召回浪费成本，且容易引入噪声证据。",
      insight:
        "先用轻量分类器判断 query 模态意图，只在需要的模态触发对应索引召回。",
      benefits: ["召回更精准", "推理成本下降", "便于 A/B 评估"],
      costs: ["路由器需要监督数据", "意图边界模糊时仍需兜底"],
      tradeoffs: ["精准度提升，但工程链路增加一层依赖。"],
      fromNodeId: "paper-fusion",
      suggestedCollectionId: "multimodal-rag"
    },
    {
      id: "cand-layout",
      title: "Layout-first Chunking",
      problem: "把表格、脚注、正文混在同一 chunk 会让多模态检索严重退化。",
      insight: "在 chunk 切分前先做版面分块，按区域类型决定 chunking 粒度。",
      benefits: ["结构信息保留", "表格独立可检索", "减少跨段错配"],
      costs: ["前处理链路更长", "对模板差异敏感"],
      tradeoffs: ["精度提高，但需要持续维护版面规则集。"],
      fromNodeId: "paper-layout",
      suggestedCollectionId: "ocr-document"
    },
    {
      id: "cand-eval",
      title: "Hybrid Recall Evaluation Set",
      problem: "纯文本 RAG 的指标无法反映多模态召回质量。",
      insight:
        "构建按问题类型 + 模态偏好分桶的评估集，用 modality-aware recall 与 grounding 指标。",
      benefits: ["发现模态盲区", "指导路由策略", "可回归"],
      costs: ["评测集构造与标注开销", "需要持续刷新"],
      tradeoffs: ["可观测性显著提升，但需要专门治理评估集。"],
      fromNodeId: "paper-eval",
      suggestedCollectionId: "multimodal-rag"
    }
  ]
};

/**
 * 根据 URL 和标题推断网页结果的内容类型。
 */
function classifyWebResult(url: string, title: string): AgentNodeType {
  const lower = url.toLowerCase();
  const titleLower = title.toLowerCase();

  // 视频平台
  if (
    /youtube\.com|youtu\.be|bilibili\.com|vimeo\.com|dailymotion\.com|twitch\.tv|douyin\.com|ixigua\.com|v\.qq\.com|v\.youku\.com|haokan\.baidu\.com/
      .test(lower) ||
    titleLower.includes("video") ||
    titleLower.includes("视频") ||
    titleLower.includes("lecture") ||
    titleLower.includes("讲座")
  ) {
    return "video";
  }

  // GitHub 仓库
  if (/github\.com\/[^/]+\/[^/]+/.test(lower) || /gitlab\.com/.test(lower)) {
    return "github_repo";
  }

  // 新闻
  if (
    /techcrunch|theverge|wired\.com|arstechnica|36kr\.com|infoq|venturebeat/
      .test(lower) ||
    titleLower.includes("发布") ||
    titleLower.includes("launch") ||
    titleLower.includes("announce")
  ) {
    return "news";
  }

  // 技术文档
  if (
    /docs\.|readthedocs|\.readthedocs\.io|developer\.|devdocs|swagger/.test(lower) ||
    titleLower.includes("documentation") ||
    titleLower.includes("api reference") ||
    titleLower.includes("技术文档")
  ) {
    return "doc";
  }

  // 课程平台
  if (
    /coursera\.org|udemy\.com|edx\.org|mooc|class\.stanford|learn\./.test(lower) ||
    titleLower.includes("course") ||
    titleLower.includes("tutorial") ||
    titleLower.includes("课程") ||
    titleLower.includes("教程")
  ) {
    return "course";
  }

  // 产品页面
  if (
    /producthunt\.com|\.app$|pricing|features/.test(lower) ||
    titleLower.includes("pricing") ||
    titleLower.includes("product")
  ) {
    return "product";
  }

  // 报告
  if (
    titleLower.includes("report") ||
    titleLower.includes("survey") ||
    titleLower.includes("白皮书") ||
    titleLower.includes("报告")
  ) {
    return "report";
  }

  // 默认: 博客
  return "blog";
}

/**
 * 把后端 AgentRunResult（papers + webResults + outline + trickCandidates）
 * 适配为前端图谱结构（clusters / nodes / edges / candidates）。
 */
function adaptAgentResult(
  backend: AgentRunResult,
  selectedTypes: AgentNodeType[]
): AgentResult {
  const clusters: AgentCluster[] = backend.outline.length
    ? backend.outline.map((o, i) => ({
        id: o.id || `cluster-${i}`,
        label: o.title,
        description: o.description
      }))
    : [
        {
          id: "search",
          label: "检索结果",
          description: backend.llmAvailable
            ? "未生成大纲，仅展示原始检索"
            : "未配置 LLM，仅展示论文 / 网页检索结果"
        }
      ];

  const topicNodeId = "topic-root";
  const nodes: AgentNode[] = [
    {
      id: topicNodeId,
      type: "topic",
      title: backend.topic,
      cluster: clusters[0]?.id ?? "search"
    }
  ];
  const edges: AgentEdge[] = [];

  backend.papers.forEach((p, i) => {
    const id = `paper-${p.id || i}`;
    const cluster = clusters[i % clusters.length]?.id ?? "search";
    const subtitleBits: string[] = [];
    if (p.authors?.length) subtitleBits.push(p.authors.slice(0, 3).join(", "));
    const yr = p.year || (p.published ? p.published.slice(0, 4) : "");
    if (yr) subtitleBits.push(String(yr));
    if (p.primaryCategory) subtitleBits.push(p.primaryCategory);
    nodes.push({
      id,
      type: "paper",
      title: p.title,
      subtitle: subtitleBits.join(" · "),
      source: p.source === "semantic_scholar" ? "Semantic Scholar" : "arXiv",
      url: p.url,
      cluster
    });
    edges.push({ from: topicNodeId, to: id, type: "same_topic" });
  });

  backend.webResults.forEach((w, i) => {
    const id = `web-${i}`;
    const cluster = clusters[i % clusters.length]?.id ?? "search";
    let host = "";
    try {
      host = new URL(w.url).hostname;
    } catch {
      host = "";
    }
    const inferredType = classifyWebResult(w.url, w.title);
    nodes.push({
      id,
      type: inferredType,
      title: w.title,
      subtitle: w.snippet ? w.snippet.slice(0, 80) : undefined,
      source: host,
      url: w.url,
      cluster
    });
    edges.push({ from: topicNodeId, to: id, type: "mentions" });
  });

  const paperNodeIds = nodes.filter((n) => n.type === "paper").map((n) => n.id);
  const candidates: AgentCandidate[] = backend.trickCandidates.map((c, i) => ({
    id: `cand-${i}`,
    title: c.title,
    problem: c.problem,
    insight: c.solution,
    benefits: c.benefits ?? [],
    costs: c.costs ?? [],
    tradeoffs: [],
    fromNodeId: paperNodeIds[i] ?? paperNodeIds[0] ?? topicNodeId
  }));

  // 按 contentTypes 过滤
  const keptIds = new Set<string>([topicNodeId]);
  const filteredNodes = nodes.filter((n) => {
    if (n.type === "topic" || selectedTypes.includes(n.type)) {
      keptIds.add(n.id);
      return true;
    }
    return false;
  });
  const filteredEdges = edges.filter(
    (e) => keptIds.has(e.from) && keptIds.has(e.to)
  );

  return {
    topic: backend.topic,
    contentTypes: selectedTypes,
    clusters,
    nodes: filteredNodes,
    edges: filteredEdges,
    candidates
  };
}

export function AgentWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { collections, saveCard } = useTrickStore();

  // 从全局缓存恢复状态，页面切换后不丢失
  const cached = getAgentCache();

  const [input, setInput] = useState(
    searchParams.get("q") || cached.input || "Multimodal RAG over enterprise PDF and screenshots"
  );
  const [venues, setVenues] = useState(cached.venues);
  const [selectedTypes, setSelectedTypes] =
    useState<AgentNodeType[]>(cached.selectedTypes as AgentNodeType[]);
  const [stepStatus, setStepStatus] = useState<Record<StepKey, StepStatus>>(
    () => {
      // 如果有缓存结果，所有 step 都标 done；如果正在运行，标 search 为 running
      const base = agentSteps.reduce(
        (acc, step) => {
          acc[step.key] = cached.result ? "done" : cached.running ? "pending" : "pending";
          return acc;
        },
        {} as Record<StepKey, StepStatus>
      );
      if (cached.running) base.search = "running";
      return base;
    }
  );
  const [running, setRunning] = useState(cached.running);
  const [result, setResult] = useState<AgentResult | null>(() => {
    if (cached.result) {
      return adaptAgentResult(cached.result, cached.selectedTypes as AgentNodeType[]);
    }
    return null;
  });
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [savedCandidateIds, setSavedCandidateIds] = useState<string[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(cached.error);
  const [llmAvailable, setLlmAvailable] = useState<boolean | null>(cached.llmAvailable);
  const [tavilyAvailable, setTavilyAvailable] = useState<boolean | null>(cached.tavilyAvailable);
  const [aiConfigured, setAiConfigured] = useState(false);

  useEffect(() => {
    const refresh = () => setAiConfigured(isAIConfigComplete(loadAIConfig()));
    refresh();
    window.addEventListener("trick-cards:ai-config-change", refresh);
    return () =>
      window.removeEventListener("trick-cards:ai-config-change", refresh);
  }, []);

  // 恢复正在运行的 fetch（从其他页面切回时）
  useEffect(() => {
    const c = getAgentCache();
    if (c.running && c.pendingFetch) {
      let alive = true;
      c.pendingFetch.then((backendResult) => {
        if (!alive) return;
        const allDone = agentSteps.reduce(
          (acc, step) => { acc[step.key] = "done"; return acc; },
          {} as Record<StepKey, StepStatus>
        );
        setStepStatus(allDone);
        const adapted = adaptAgentResult(backendResult, selectedTypes);
        setResult(adapted);
        setSelectedNodeId(adapted.nodes[0]?.id ?? null);
        setLlmAvailable(backendResult.llmAvailable);
        setTavilyAvailable(backendResult.tavilyAvailable);
        setRunning(false);
        setAgentCache({
          running: false,
          result: backendResult,
          llmAvailable: backendResult.llmAvailable,
          tavilyAvailable: backendResult.tavilyAvailable,
          pendingFetch: null
        });
      }).catch((err) => {
        if (!alive) return;
        setError((err as Error).message || "Agent 运行失败");
        setRunning(false);
        setAgentCache({ running: false, error: (err as Error).message, pendingFetch: null });
      });
      return () => { alive = false; };
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 同步输入状态到缓存
  useEffect(() => {
    setAgentCache({ input, venues, selectedTypes });
  }, [input, venues, selectedTypes]);

  useEffect(() => {
    if (!toast) {
      return;
    }
    const handle = window.setTimeout(() => setToast(null), 2400);
    return () => window.clearTimeout(handle);
  }, [toast]);

  function toggleType(type: AgentNodeType) {
    setSelectedTypes((current) =>
      current.includes(type)
        ? current.filter((value) => value !== type)
        : [...current, type]
    );
  }

  async function runAgent() {
    if (!input.trim() || running) {
      return;
    }

    if (!selectedTypes.length) {
      setToast("请至少选择一种内容类型再运行 Agent");
      return;
    }

    setRunning(true);
    setResult(null);
    setSelectedNodeId(null);
    setSavedCandidateIds([]);
    setError(null);

    // 重置 step 状态
    const initialStatus = agentSteps.reduce(
      (acc, step) => {
        acc[step.key] = "pending";
        return acc;
      },
      {} as Record<StepKey, StepStatus>
    );
    setStepStatus(initialStatus);

    // 视觉效果：边请求边推进 step。前 3 步（解析/分类/搜索）随时间推进，
    // 等 fetch 完成时把剩余 step 一次性标 done。
    let cancelled = false;
    const nextStatus = { ...initialStatus };
    const advanceStep = async (key: StepKey, delay = 280) => {
      nextStatus[key] = "running";
      setStepStatus({ ...nextStatus });
      await new Promise((r) => window.setTimeout(r, delay));
      if (cancelled) return;
      nextStatus[key] = "done";
      setStepStatus({ ...nextStatus });
    };

    // 启动真实 fetch（与动画并行），并存入全局缓存
    const fetchPromise = (async () => {
      const venueList = venues
        .split(/[，,]/)
        .map((v) => v.trim())
        .filter(Boolean);
      const result = await callAgent(input.trim(), {
        venues: venueList.length ? venueList : undefined,
        contentTypes: selectedTypes
      });
      return result;
    })();

    // 缓存运行状态和 fetch promise（页面切走后仍可恢复）
    setAgentCache({ running: true, result: null, error: null, pendingFetch: fetchPromise });

    try {
      // 前 3 步：parse / classify / search 并发动画
      await advanceStep("parse");
      await advanceStep("classify");
      // search 标 running，然后等 fetch 完成
      nextStatus.search = "running";
      setStepStatus({ ...nextStatus });

      const backendResult = await fetchPromise;
      if (cancelled) return;

      // 一口气把后面所有 step 标 done
      const remaining: StepKey[] = [
        "search",
        "dedupe",
        "relate",
        "graph",
        "path",
        "tricks"
      ];
      for (const key of remaining) {
        nextStatus[key] = "done";
      }
      setStepStatus({ ...nextStatus });

      const adapted = adaptAgentResult(backendResult, selectedTypes);
      setResult(adapted);
      setSelectedNodeId(adapted.nodes[0]?.id ?? null);
      setLlmAvailable(backendResult.llmAvailable);
      setTavilyAvailable(backendResult.tavilyAvailable);

      // 缓存结果
      setAgentCache({
        running: false,
        result: backendResult,
        llmAvailable: backendResult.llmAvailable,
        tavilyAvailable: backendResult.tavilyAvailable,
        pendingFetch: null
      });

      if (!backendResult.llmAvailable) {
        setToast(
          "未配置 LLM：已显示免费检索结果，暂不生成大纲与 trick 候选。点左下角「AI 设置」可配置 API Key。"
        );
      } else if (!backendResult.papers.length && !backendResult.webResults.length) {
        setToast("没有检索到相关内容，试着换个更具体的英文主题词");
      } else if (!backendResult.tavilyAvailable && !backendResult.webResults.length) {
        const nonPaperTypes = selectedTypes.filter((t) => t !== "paper");
        if (nonPaperTypes.length > 0) {
          setToast(
            `视频、博客、GitHub 等非论文类型需要配置 Tavily API Key。在「AI 设置」中填入即可检索更多类型内容。`
          );
        }
      }
    } catch (err) {
      cancelled = true;
      const msg = (err as Error).message || "Agent 运行失败";
      setError(msg);
      setAgentCache({ running: false, error: msg, pendingFetch: null });
      // 把当前 running 步骤回退
      const reset = { ...nextStatus };
      Object.keys(reset).forEach((k) => {
        if (reset[k as StepKey] === "running") reset[k as StepKey] = "pending";
      });
      setStepStatus(reset);
    } finally {
      setRunning(false);
    }
  }

  function generateTrickCard(candidate: AgentCandidate) {
    const fallbackCollection = collections[0];
    const collectionId =
      collections.find(
        (collection) => collection.id === candidate.suggestedCollectionId
      )?.id ??
      fallbackCollection?.id ??
      "";

    if (!collectionId) {
      window.alert("当前没有可用的专栏，请先在 Collections 页创建一个。");
      return;
    }

    const now = new Date().toISOString();
    const id = `card-agent-${candidate.id}-${Date.now()}`;

    const nextCard: TrickCard = {
      id,
      title: candidate.title,
      subtitle: "由 Agent 候选生成",
      description: candidate.insight,
      collectionId,
      tags: ["Agent", "Multimodal RAG"],
      domain: "Agent suggested",
      status: "todo",
      problem: candidate.problem,
      solution: candidate.insight,
      benefits: candidate.benefits,
      costs: candidate.costs,
      tradeoffs: candidate.tradeoffs,
      applicableScenarios: [],
      unsuitableScenarios: [],
      notes: [
        {
          id: `note-${id}`,
          content: `来源节点：${
            result?.nodes.find((node) => node.id === candidate.fromNodeId)
              ?.title ?? candidate.fromNodeId
          }`,
          createdAt: now
        }
      ],
      sources: [],
      usages: [],
      relatedCardIds: [],
      images: [],
      createdAt: now,
      updatedAt: now
    };

    saveCard(nextCard);
    setSavedCandidateIds((current) =>
      current.includes(candidate.id) ? current : [...current, candidate.id]
    );
    setToast(`已生成 Trick：${candidate.title}`);
  }

  const selectedNode = useMemo(() => {
    if (!result || !selectedNodeId) {
      return null;
    }
    return result.nodes.find((node) => node.id === selectedNodeId) ?? null;
  }, [result, selectedNodeId]);

  const selectedNodeEdges = useMemo(() => {
    if (!result || !selectedNode) {
      return [];
    }
    return result.edges.filter(
      (edge) =>
        edge.from === selectedNode.id || edge.to === selectedNode.id
    );
  }, [result, selectedNode]);

  return (
    <DashboardLayout>
      <TopBar
        title="知识图谱"
        eyebrow=""
        secondaryAction={{
          label: "去每日推送",
          icon: ArrowRight,
          onClick: () => router.push("/daily")
        }}
      />

      <div className="space-y-5 px-5 py-5 xl:px-8">
        <AgentStatusBanner
          aiConfigured={aiConfigured}
          running={running}
          error={error}
          llmAvailable={llmAvailable}
          tavilyAvailable={tavilyAvailable}
          selectedTypes={selectedTypes}
          hasResult={Boolean(result)}
        />

        <InputPanel
          input={input}
          onInputChange={setInput}
          venues={venues}
          onVenuesChange={setVenues}
          selectedTypes={selectedTypes}
          onToggleType={toggleType}
          running={running}
          onRun={runAgent}
        />

        <ProgressPanel stepStatus={stepStatus} hasResult={Boolean(result)} />

        {result ? (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <div className="space-y-5">
              <KnowledgeGraph
                result={result}
                selectedNodeId={selectedNodeId}
                onSelect={setSelectedNodeId}
              />
              <SourceClusters
                result={result}
                selectedNodeId={selectedNodeId}
                onSelect={setSelectedNodeId}
              />
            </div>
            <div className="space-y-5 xl:sticky xl:top-5 xl:self-start">
              <SelectedNodeCard
                node={selectedNode}
                edges={selectedNodeEdges}
                allNodes={result.nodes}
              />
            </div>
          </div>
        ) : running ? null : (
          <EmptyState />
        )}
      </div>

      {toast ? (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-slate-900 px-4 py-2 text-xs font-medium text-white shadow-panel">
          {toast}
        </div>
      ) : null}
    </DashboardLayout>
  );
}

type InputPanelProps = {
  input: string;
  onInputChange: (value: string) => void;
  venues: string;
  onVenuesChange: (value: string) => void;
  selectedTypes: AgentNodeType[];
  onToggleType: (type: AgentNodeType) => void;
  running: boolean;
  onRun: () => void;
};

function InputPanel({
  input,
  onInputChange,
  venues,
  onVenuesChange,
  selectedTypes,
  onToggleType,
  running,
  onRun
}: InputPanelProps) {
  return (
    <section className="rounded-2xl border border-border/80 bg-surface p-5 shadow-soft">
      <div className="flex items-center gap-2 text-xs tracking-[0.18em] text-slate-500">
        <Bot className="h-3.5 w-3.5" />
        输入知识起点
      </div>
      <textarea
        value={input}
        onChange={(event) => onInputChange(event.target.value)}
        placeholder="粘贴论文、GitHub 链接、博客地址，或输入一个技术主题（建议使用英文）"
        className="mt-3 h-28 w-full resize-none rounded-xl border border-border bg-white px-3 py-2.5 text-sm text-text-main outline-none focus:border-primary"
      />

      <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
            内容类型
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {allContentTypes.map((type) => {
              const meta = contentTypeMeta[type];
              const Icon = meta.icon;
              const active = selectedTypes.includes(type);
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => onToggleType(type)}
                  className={cn(
                    "flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition",
                    active
                      ? "border-primary bg-primary text-white"
                      : "border-border bg-white text-slate-600 hover:border-slate-400"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {meta.label}
                </button>
              );
            })}
          </div>
          {selectedTypes.includes("paper") ? (
            <input
              value={venues}
              onChange={(event) => onVenuesChange(event.target.value)}
              placeholder="指定期刊 / 会议：IEEE, CVPR, ACM, Nature, ISSCC …（留空 = 不限）"
              className="mt-2 h-8 w-full rounded-full border border-border bg-white px-3 text-xs text-text-main outline-none placeholder:text-slate-400 focus:border-primary"
            />
          ) : null}
        </div>

        <button
          type="button"
          onClick={onRun}
          disabled={running || !input.trim() || !selectedTypes.length}
          className="flex h-10 items-center gap-2 self-end rounded-xl bg-primary px-4 text-sm font-medium text-white shadow-soft disabled:cursor-not-allowed disabled:opacity-55 lg:self-auto"
        >
          {running ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Play className="h-4 w-4" />
          )}
          {running ? "Agent 运行中" : "运行 Agent"}
        </button>
      </div>
    </section>
  );
}

function AgentStatusBanner({
  aiConfigured,
  running,
  error,
  llmAvailable,
  tavilyAvailable,
  selectedTypes,
  hasResult
}: {
  aiConfigured: boolean;
  running: boolean;
  error: string | null;
  llmAvailable: boolean | null;
  tavilyAvailable: boolean | null;
  selectedTypes: AgentNodeType[];
  hasResult: boolean;
}) {
  // GitHub 和 B 站视频已内置免费搜索，无需 Tavily
  // Tavily 仅用于博客、新闻、课程、报告、产品等类型
  const tavilyOnlyTypes = ["blog", "doc", "news", "course", "report", "product"];
  const needsTavily = selectedTypes.some((t) => tavilyOnlyTypes.includes(t));
  const tavilyConfigured = tavilyAvailable ?? Boolean(loadAIConfig().tavilyApiKey);
  const showTavilyWarning = needsTavily && !tavilyConfigured;
  if (error) {
    return (
      <div className="flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs leading-5 text-rose-700">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <span className="font-semibold">Agent 运行失败：</span>
          {error}
          {!aiConfigured ? (
            <span className="ml-1 text-rose-600/80">
              （多数情况下因 API Key 未配置——点左下角「AI 设置」按钮）
            </span>
          ) : null}
        </div>
      </div>
    );
  }

  if (running) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs leading-5 text-blue-700">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>
          正在检索相关内容（OpenAlex + arXiv + GitHub + B 站 + YouTube）
          {aiConfigured ? "，并用 LLM 生成大纲与 trick 候选" : ""}…
        </span>
      </div>
    );
  }

  if (!hasResult) {
    if (!aiConfigured) {
      return (
        <div className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            未配置 AI 也能运行——将使用 arXiv、OpenAlex、GitHub、B 站和 YouTube 等免费检索源。
            如需 AI 生成大纲与 trick 候选，请在左下角「AI 设置」中配置 API Key。
          </div>
        </div>
      );
    }
    if (showTavilyWarning) {
      return (
        <div className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <span className="font-semibold">博客、新闻、课程等类型需要 Tavily 搜索引擎。</span>
            论文、GitHub 仓库、B 站 / YouTube 视频已内置免费搜索，无需额外配置。
            如需搜索博客、新闻、课程、报告等内容，可前往{" "}
            <a href="https://tavily.com" target="_blank" rel="noopener noreferrer" className="font-medium underline">tavily.com</a>
            {" "}免费注册获取 Key，在左下角「AI 设置」中填入。
          </div>
        </div>
      );
    }
    return null;
  }

  // 已有结果
  if (llmAvailable === false) {
    return (
      <div className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          仅返回免费检索结果，未生成大纲 / trick 候选——后端检测 LLM 不可用。
          请确认左下角「AI 设置」里的 API Key、base_url、model 都已正确填写。
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs leading-5 text-emerald-700">
        <CheckCircle2 className="h-4 w-4" />
        <span>已完成多源检索（OpenAlex + arXiv + GitHub + B 站 + YouTube）与 LLM 生成。点节点查看详情，或在右侧把 trick 候选转成卡片。</span>
      </div>
    </div>
  );
}

function ProgressPanel({
  stepStatus,
  hasResult
}: {
  stepStatus: Record<StepKey, StepStatus>;
  hasResult: boolean;
}) {
  const completed = agentSteps.filter(
    (step) => stepStatus[step.key] === "done"
  ).length;
  const percent = Math.round((completed / agentSteps.length) * 100);

  return (
    <section className="rounded-2xl border border-border/80 bg-surface p-4 shadow-soft">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2 text-xs tracking-[0.18em] text-slate-500">
          <Radar className="h-3.5 w-3.5 text-primary" />
          任务进度
          <span className="ml-2 rounded-full bg-primary-soft px-2 py-0.5 text-[11px] font-medium text-primary">
            {percent}%
          </span>
        </div>
        {hasResult ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
            <CheckCircle2 className="h-3 w-3" />
            已完成最近一次运行
          </span>
        ) : null}
      </div>

      <ol className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {agentSteps.map((step, index) => {
          const status = stepStatus[step.key];
          return (
            <li
              key={step.key}
              className={cn(
                "flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-xs",
                status === "done"
                  ? "border-emerald-200 bg-emerald-50/60 text-emerald-700"
                  : status === "running"
                  ? "border-primary/50 bg-primary-soft text-primary"
                  : "border-border text-slate-500"
              )}
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-[11px] font-semibold">
                {status === "done" ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                ) : status === "running" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  index + 1
                )}
              </span>
              <span className="font-medium">{step.label}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

type KnowledgeGraphProps = {
  result: AgentResult;
  selectedNodeId: string | null;
  onSelect: (id: string) => void;
};

function KnowledgeGraph({
  result,
  selectedNodeId,
  onSelect
}: KnowledgeGraphProps) {
  const WIDTH = 760;
  const HEIGHT = 460;

  const initialLayout = useMemo(() => {
    const cx = WIDTH / 2;
    const cy = HEIGHT / 2;
    const positions: Record<string, { x: number; y: number }> = {};

    const clusterCount = result.clusters.length || 1;
    const clusterPositions: Record<string, { x: number; y: number }> = {};
    result.clusters.forEach((cluster, index) => {
      const angle =
        (index / clusterCount) * 2 * Math.PI - Math.PI / 2;
      clusterPositions[cluster.id] = {
        x: cx + Math.cos(angle) * 220,
        y: cy + Math.sin(angle) * 150
      };
    });

    for (const cluster of result.clusters) {
      const nodes = result.nodes.filter(
        (node) => node.cluster === cluster.id && node.type !== "topic"
      );
      const center = clusterPositions[cluster.id];
      nodes.forEach((node, index) => {
        const angle = (index / Math.max(nodes.length, 1)) * 2 * Math.PI;
        const radius = 80 + (index % 2) * 22;
        positions[node.id] = {
          x: center.x + Math.cos(angle) * radius,
          y: center.y + Math.sin(angle) * radius
        };
      });
    }

    const topicNode = result.nodes.find((node) => node.type === "topic");
    if (topicNode) {
      positions[topicNode.id] = { x: cx, y: cy };
    }

    return { positions, clusterPositions };
  }, [result]);

  const [positions, setPositions] = useState(initialLayout.positions);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<{ nodeId: string; offsetX: number; offsetY: number } | null>(null);

  // result 变化时重置位置
  useEffect(() => {
    setPositions(initialLayout.positions);
  }, [initialLayout.positions]);

  function svgPoint(clientX: number, clientY: number) {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const svgP = pt.matrixTransform(ctm.inverse());
    return { x: svgP.x, y: svgP.y };
  }

  function handlePointerDown(e: React.PointerEvent, nodeId: string) {
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    const p = svgPoint(e.clientX, e.clientY);
    const pos = positions[nodeId];
    dragRef.current = { nodeId, offsetX: p.x - pos.x, offsetY: p.y - pos.y };
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!dragRef.current) return;
    const p = svgPoint(e.clientX, e.clientY);
    const { nodeId, offsetX, offsetY } = dragRef.current;
    setPositions((prev) => ({
      ...prev,
      [nodeId]: { x: p.x - offsetX, y: p.y - offsetY }
    }));
  }

  function handlePointerUp() {
    dragRef.current = null;
  }

  const layout = { width: WIDTH, height: HEIGHT, positions, clusterPositions: initialLayout.clusterPositions };

  function nodeFill(type: AgentNodeType, active: boolean) {
    if (active) {
      return "#1E40AF";
    }
    switch (type) {
      case "topic":
        return "#0F172A";
      case "paper":
        return "#7C3AED";
      case "github_repo":
        return "#16A34A";
      case "blog":
        return "#0891B2";
      case "video":
        return "#F97316";
      case "doc":
        return "#2563EB";
      case "report":
        return "#9333EA";
      case "product":
        return "#EC4899";
      case "news":
        return "#0EA5E9";
      default:
        return "#475569";
    }
  }

  return (
    <section className="rounded-2xl border border-border/80 bg-surface p-4 shadow-soft">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs tracking-[0.18em] text-slate-500">
          <GitBranch className="h-3.5 w-3.5 text-primary" />
          知识图谱
        </div>
        <span className="text-[11px] text-slate-500">
          {result.nodes.length} 个节点 · {result.edges.length} 条关系 · 点击节点查看详情
        </span>
      </div>

      <div className="mt-3 overflow-x-auto rounded-2xl border border-border bg-slate-50">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          className="h-[420px] w-full min-w-[640px]"
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        >
          {result.clusters.map((cluster) => {
            const center = layout.clusterPositions[cluster.id];
            if (!center) return null;
            return (
              <circle
                key={cluster.id}
                cx={center.x}
                cy={center.y}
                r={120}
                fill="white"
                stroke="#CBD5F5"
                strokeDasharray="4 4"
                opacity={0.55}
              />
            );
          })}

          {result.edges.map((edge, index) => {
            const from = layout.positions[edge.from];
            const to = layout.positions[edge.to];
            if (!from || !to) return null;
            const isActive =
              selectedNodeId === edge.from || selectedNodeId === edge.to;
            return (
              <line
                key={`${edge.from}-${edge.to}-${index}`}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke={edgeMeta[edge.type].color}
                strokeWidth={isActive ? 1.6 : 1}
                strokeOpacity={isActive ? 0.85 : 0.45}
              />
            );
          })}

          {result.nodes.map((node) => {
            const position = layout.positions[node.id];
            if (!position) return null;
            const active = selectedNodeId === node.id;
            const isTopic = node.type === "topic";
            const radius = isTopic ? 26 : active ? 20 : 16;
            return (
              <g
                key={node.id}
                transform={`translate(${position.x}, ${position.y})`}
                onClick={() => { if (!dragRef.current) onSelect(node.id); }}
                onPointerDown={(e) => handlePointerDown(e, node.id)}
                className="cursor-grab active:cursor-grabbing"
              >
                <circle
                  r={radius}
                  fill={nodeFill(node.type, active)}
                  stroke={active ? "#1E40AF" : "white"}
                  strokeWidth={active ? 3 : 2}
                />
                <text
                  textAnchor="middle"
                  y={radius + 14}
                  className="fill-slate-700"
                  style={{ fontSize: 10, fontWeight: 500 }}
                >
                  {node.title.length > 24
                    ? `${node.title.slice(0, 24)}…`
                    : node.title}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <ul className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
        {(["topic", "paper", "github_repo", "video"] as AgentNodeType[]).map(
          (type) => (
            <li key={type} className="flex items-center gap-1.5">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: nodeFill(type, false) }}
              />
              {contentTypeMeta[type].label}
            </li>
          )
        )}
      </ul>
    </section>
  );
}

function SourceClusters({
  result,
  selectedNodeId,
  onSelect
}: {
  result: AgentResult;
  selectedNodeId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <section className="rounded-2xl border border-border/80 bg-surface p-4 shadow-soft">
      <div className="flex items-center gap-2 text-xs tracking-[0.18em] text-slate-500">
        <Layers className="h-3.5 w-3.5 text-primary" />
        知识源簇
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {result.clusters.map((cluster) => {
          const nodes = result.nodes.filter(
            (node) => node.cluster === cluster.id && node.type !== "topic"
          );
          if (!nodes.length) {
            return null;
          }
          return (
            <div
              key={cluster.id}
              className="rounded-2xl border border-border bg-white p-3"
            >
              <div className="text-sm font-semibold text-text-main">
                {cluster.label}
              </div>
              <p className="mt-1 text-[11px] leading-5 text-text-secondary">
                {cluster.description}
              </p>
              <ul className="mt-2 space-y-1.5">
                {nodes.map((node) => {
                  const meta = contentTypeMeta[node.type];
                  const Icon = meta.icon;
                  const active = selectedNodeId === node.id;
                  return (
                    <li key={node.id}>
                      <button
                        type="button"
                        onClick={() => onSelect(node.id)}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-xl border px-2.5 py-1.5 text-left text-xs transition",
                          active
                            ? "border-primary bg-primary-soft text-primary"
                            : "border-border bg-white text-slate-700 hover:border-slate-400"
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        <span className="flex-1 truncate">{node.title}</span>
                        {node.recommendation ? (
                          <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                            推荐
                          </span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function SelectedNodeCard({
  node,
  edges,
  allNodes
}: {
  node: AgentNode | null;
  edges: AgentEdge[];
  allNodes: AgentNode[];
}) {
  if (!node) {
    return null;
  }
  const meta = contentTypeMeta[node.type];
  const Icon = meta.icon;

  return (
    <section className="rounded-2xl border border-border/80 bg-surface p-4 shadow-soft">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-soft text-primary">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            {meta.label}
            {node.source ? ` · ${node.source}` : ""}
          </div>
          <h3 className="mt-1 text-base font-semibold text-text-main">
            {node.title}
          </h3>
          {node.subtitle ? (
            <p className="mt-1 text-xs text-text-secondary">{node.subtitle}</p>
          ) : null}
        </div>
        {node.url ? (
          <a
            href={node.url}
            target="_blank"
            rel="noreferrer"
            className="flex h-8 shrink-0 items-center gap-1.5 rounded-xl border border-border px-2.5 text-xs font-medium text-slate-600 hover:border-primary hover:text-primary"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            {node.type === "paper" ? "跳转论文" :
             node.type === "github_repo" ? "跳转仓库" :
             node.type === "video" ? "跳转视频" : "跳转链接"}
          </a>
        ) : null}
      </div>

      {node.recommendation ? (
        <div className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <Sparkles className="mt-0.5 h-3.5 w-3.5" />
          {node.recommendation}
        </div>
      ) : null}

      {node.highlights?.length ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {node.highlights.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600"
            >
              {tag}
            </span>
          ))}
        </div>
      ) : null}

      {edges.length ? (
        <div className="mt-3 border-t border-border pt-3">
          <div className="text-[10px] font-semibold tracking-[0.18em] text-slate-500">
            关系·{edges.length} 条
          </div>
          <ul className="mt-2 space-y-1.5">
            {edges.map((edge, index) => {
              const otherId = edge.from === node.id ? edge.to : edge.from;
              const direction = edge.from === node.id ? "→" : "←";
              const otherNode = allNodes.find((n) => n.id === otherId);
              if (!otherNode) return null;
              return (
                <li
                  key={`${edge.from}-${edge.to}-${index}`}
                  className="flex items-center gap-2 text-xs text-slate-600"
                >
                  <span
                    className="inline-flex h-5 shrink-0 items-center whitespace-nowrap rounded-full px-2 text-[10px] font-medium"
                    style={{
                      backgroundColor: `${edgeMeta[edge.type].color}22`,
                      color: edgeMeta[edge.type].color
                    }}
                  >
                    {edgeMeta[edge.type].label}
                  </span>
                  <span className="shrink-0 text-slate-400">{direction}</span>
                  <span className="truncate">{otherNode.title}</span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function TrickCandidates({
  candidates,
  savedIds,
  collections,
  onGenerate,
  onView
}: {
  candidates: AgentCandidate[];
  savedIds: string[];
  collections: Collection[];
  onGenerate: (candidate: AgentCandidate) => void;
  onView: () => void;
}) {
  return (
    <section className="rounded-2xl border border-border/80 bg-surface p-4 shadow-soft">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs tracking-[0.18em] text-slate-500">
          <Lightbulb className="h-3.5 w-3.5 text-primary" />
          Trick 候选
        </div>
        {savedIds.length ? (
          <button
            type="button"
            onClick={onView}
            className="text-[11px] font-medium text-primary"
          >
            去卡片墙查看 →
          </button>
        ) : null}
      </div>

      <ul className="mt-3 space-y-2.5">
        {candidates.map((candidate) => {
          const saved = savedIds.includes(candidate.id);
          const collection = collections.find(
            (collection) => collection.id === candidate.suggestedCollectionId
          );

          return (
            <li
              key={candidate.id}
              className="rounded-2xl border border-border bg-white p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold text-text-main">
                    {candidate.title}
                  </div>
                  <p className="mt-1 text-[11px] leading-5 text-text-secondary">
                    {candidate.problem}
                  </p>
                </div>
                {collection ? (
                  <span
                    className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
                    style={{
                      backgroundColor: `${collection.color}18`,
                      color: collection.color
                    }}
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: collection.color }}
                    />
                    {collection.name}
                  </span>
                ) : null}
              </div>

              <div className="mt-2 grid gap-2 text-[11px] leading-5 sm:grid-cols-2">
                <BulletBlock label="Insight" items={[candidate.insight]} />
                <BulletBlock label="Benefits" items={candidate.benefits} />
                <BulletBlock label="Costs" items={candidate.costs} />
                <BulletBlock label="Trade-offs" items={candidate.tradeoffs} />
              </div>

              <div className="mt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => onGenerate(candidate)}
                  className={cn(
                    "flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition",
                    saved
                      ? "bg-emerald-500 text-white"
                      : "bg-primary text-white hover:opacity-90"
                  )}
                >
                  {saved ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      已生成
                    </>
                  ) : (
                    <>
                      <Plus className="h-3.5 w-3.5" />
                      生成 Trick Card
                    </>
                  )}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function BulletBlock({ label, items }: { label: string; items: string[] }) {
  if (!items.length) {
    return null;
  }
  return (
    <div className="rounded-xl bg-slate-50 p-2">
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
        {label}
      </div>
      <ul className="mt-1 space-y-0.5 text-slate-700">
        {items.map((item) => (
          <li key={item}>• {item}</li>
        ))}
      </ul>
    </div>
  );
}

function EmptyState() {
  return (
    <section className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-white p-12 text-center shadow-soft">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
        <Globe className="h-6 w-6" />
      </div>
      <div>
        <div className="text-base font-semibold text-text-main">
          还没运行 Agent
        </div>
        <p className="mt-1 text-xs leading-5 text-text-secondary">
          在上方输入主题或链接，选好关心的内容类型，点击「运行 Agent」即可生成知识图谱与 Trick 候选。
        </p>
      </div>
      <button
        type="button"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        className="flex h-9 items-center gap-1.5 rounded-full border border-border bg-white px-3 text-xs font-medium text-slate-600"
      >
        <RefreshCcw className="h-3.5 w-3.5" />
        滚动到输入区
      </button>
      <div className="mt-1 flex items-center gap-1 text-[11px] text-slate-400">
        <CircleDot className="h-3 w-3" />
        当前为本地 mock 推理，后续可接 LLM + 检索 API。
      </div>
    </section>
  );
}
