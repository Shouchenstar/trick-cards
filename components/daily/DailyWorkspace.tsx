"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  BookmarkPlus,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  ExternalLink,
  Filter,
  Flame,
  GitCompareArrows,
  Inbox,
  ListChecks,
  Loader2,
  Plus,
  RefreshCcw,
  Settings2,
  Sparkles,
  Sunrise,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  X
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useTrickStore } from "@/lib/store/TrickStore";
import { Paper, TrickCard } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";
import {
  isAIConfigComplete,
  loadAIConfig
} from "@/lib/ai/config-client";
import {
  getCachedDigests,
  fetchTopicDigest as bgFetchTopic,
  fetchAllTopics as bgFetchAll,
  isAnyPending,
  subscribe as subscribeDailyCache,
  startDailyScheduler,
  stopDailyScheduler,
  deleteCachedDigestCards,
} from "@/lib/store/dailyCache";
import type { DigestCacheEntry as BgCacheEntry } from "@/lib/store/dailyCache";

type DigestContentType =
  | "paper"
  | "github_repo"
  | "blog"
  | "doc"
  | "video"
  | "news"
  | "product"
  | "course"
  | "report"
  | "rss";

type DigestPriority = "must_read" | "recommended" | "optional";

type Difficulty = "easy" | "medium" | "hard" | "any";

type DigestStyle = "summary" | "deep_dive" | "headline";

type DigestFrequency = "daily" | "weekly";

type Feedback = "useful" | "irrelevant" | "too_basic" | "too_hard" | "seen";

type DigestTopic = {
  id: string;
  name: string;
  keywords: string[];
  excludeKeywords: string[];
  contentTypes: DigestContentType[];
  sources: string[];
  /** 指定期刊/会议偏好（如 IEEE, ISSCC, CVPR），空 = 不限 */
  venues: string[];
  frequency: DigestFrequency;
  pushLimit: number;
  difficulty: Difficulty;
  style: DigestStyle;
};

type DigestCard = {
  id: string;
  topicId: string;
  title: string;
  contentType: DigestContentType;
  source: string;
  summary: string;
  whyRecommend: string;
  insight: string;
  trickHint: string;
  benefits: string[];
  costs: string[];
  priority: DigestPriority;
  relatedKeywords?: string[];
  url?: string;
  publishedAt: string;
  suggestedCollectionId?: string;
};

const contentTypeMeta: Record<
  DigestContentType,
  { label: string; tone: string }
> = {
  paper: { label: "论文", tone: "bg-violet-100 text-violet-700" },
  github_repo: { label: "GitHub", tone: "bg-emerald-100 text-emerald-700" },
  blog: { label: "博客", tone: "bg-sky-100 text-sky-700" },
  doc: { label: "文档", tone: "bg-blue-100 text-blue-700" },
  video: { label: "视频", tone: "bg-orange-100 text-orange-700" },
  news: { label: "新闻", tone: "bg-cyan-100 text-cyan-700" },
  product: { label: "产品", tone: "bg-pink-100 text-pink-700" },
  course: { label: "课程", tone: "bg-amber-100 text-amber-700" },
  report: { label: "报告", tone: "bg-fuchsia-100 text-fuchsia-700" },
  rss: { label: "RSS", tone: "bg-slate-100 text-slate-700" }
};

const priorityMeta: Record<
  DigestPriority,
  { label: string; tone: string; icon: LucideIcon }
> = {
  must_read: {
    label: "必读",
    tone: "bg-rose-50 text-rose-700 border-rose-100",
    icon: Flame
  },
  recommended: {
    label: "推荐",
    tone: "bg-amber-50 text-amber-700 border-amber-100",
    icon: Sparkles
  },
  optional: {
    label: "可选",
    tone: "bg-slate-50 text-slate-600 border-slate-200",
    icon: ChevronRight
  }
};

const feedbackMeta: Record<
  Feedback,
  { label: string; tone: string; icon: LucideIcon }
> = {
  useful: {
    label: "有用",
    tone: "text-emerald-700 border-emerald-200 hover:bg-emerald-50",
    icon: ThumbsUp
  },
  irrelevant: {
    label: "不相关",
    tone: "text-slate-600 border-border hover:bg-slate-100",
    icon: ThumbsDown
  },
  too_basic: {
    label: "太基础",
    tone: "text-amber-700 border-amber-200 hover:bg-amber-50",
    icon: ChevronRight
  },
  too_hard: {
    label: "太难",
    tone: "text-rose-700 border-rose-200 hover:bg-rose-50",
    icon: ChevronRight
  },
  seen: {
    label: "已看过",
    tone: "text-blue-700 border-blue-200 hover:bg-blue-50",
    icon: CheckCircle2
  }
};

const initialTopics: DigestTopic[] = [
  {
    id: "topic-multimodal-rag",
    name: "Multimodal RAG",
    keywords: ["multimodal", "rag", "retrieval", "vlm"],
    excludeKeywords: ["chatbot demo"],
    contentTypes: ["paper", "github_repo", "blog", "video"],
    sources: ["arxiv", "github", "company blogs"],
    venues: [],
    frequency: "daily",
    pushLimit: 5,
    difficulty: "any",
    style: "summary"
  },
  {
    id: "topic-doc-ai",
    name: "Document AI",
    keywords: ["ocr", "layout", "document parsing"],
    excludeKeywords: [],
    contentTypes: ["paper", "doc", "github_repo"],
    sources: ["arxiv", "github", "fastdoc.io"],
    venues: [],
    frequency: "daily",
    pushLimit: 4,
    difficulty: "medium",
    style: "deep_dive"
  },
  {
    id: "topic-agents",
    name: "Agent Engineering",
    keywords: ["agent", "tool use", "guardrails"],
    excludeKeywords: ["agi hype"],
    contentTypes: ["paper", "blog", "report"],
    sources: ["arxiv", "engineering blogs"],
    venues: [],
    frequency: "weekly",
    pushLimit: 6,
    difficulty: "hard",
    style: "deep_dive"
  }
];

const initialCards: DigestCard[] = [
  {
    id: "digest-1",
    topicId: "topic-multimodal-rag",
    title: "Query Routing Beats Bigger Indexes in Multimodal RAG",
    contentType: "paper",
    source: "arxiv",
    summary:
      "用轻量分类器判断 query 模态，再触发对应索引，显著优于无脑全模态召回。",
    whyRecommend:
      "你最近在 trick cards 里关注 multimodal-rag-fusion，本文给出了路由层的实证收益。",
    insight: "在 RAG 之前先做 query routing，比加大索引更高效。",
    trickHint:
      "构建 modality-aware router，并把它当作 RAG pipeline 的一等公民。",
    benefits: ["命中率高", "推理成本低", "评估可分桶"],
    costs: ["路由器需要监督样本"],
    priority: "must_read",
    relatedKeywords: ["query routing", "modal weighting"],
    url: "https://arxiv.org/abs/2604.00001",
    publishedAt: "2026-04-29T08:00:00Z",
    suggestedCollectionId: "multimodal-rag"
  },
  {
    id: "digest-2",
    topicId: "topic-multimodal-rag",
    title: "open-fusion-rag v0.4 ships hybrid recall",
    contentType: "github_repo",
    source: "github.com",
    summary: "开源仓库新增 hybrid recall + reranker 配置，能直接试出 baseline。",
    whyRecommend:
      "适合作为你的对照实现，验证自研 fusion retrieval 是否拿到收益。",
    insight: "默认配置就跑通了文本 + 图像混合召回，工程门槛降低很多。",
    trickHint:
      "用此 repo 当 baseline，把自研 router 与之做 A/B，更容易判断净收益。",
    benefits: ["快速 baseline", "评估对照", "社区活跃"],
    costs: ["对接私有索引仍需改造"],
    priority: "recommended",
    url: "https://github.com/open-fusion-rag/open-fusion-rag",
    publishedAt: "2026-04-28T14:00:00Z",
    suggestedCollectionId: "multimodal-rag"
  },
  {
    id: "digest-3",
    topicId: "topic-multimodal-rag",
    title: "How we shipped a multimodal copilot",
    contentType: "blog",
    source: "engineering blog",
    summary:
      "团队复盘从单模态 RAG 升级到多模态 copilot 的路径与坑点，含线上指标。",
    whyRecommend: "你 trick cards 里关注的 fusion 与 OCR 都被实战验证。",
    insight:
      "把 OCR 解析、表格抽取与 fusion retrieval 三层放在一个 pipeline 里管理。",
    trickHint: "采用三层 pipeline 视角拆分 ownership，便于多团队协作。",
    benefits: ["架构清晰", "可观测性好"],
    costs: ["跨团队治理成本"],
    priority: "recommended",
    publishedAt: "2026-04-27T10:30:00Z"
  },
  {
    id: "digest-4",
    topicId: "topic-doc-ai",
    title: "Layout-aware Document Parsing 综述",
    contentType: "paper",
    source: "arxiv",
    summary: "系统总结 OCR 之上的版面理解工程，并提出可复用基线。",
    whyRecommend: "和你 ocr-aware-parsing 卡片直接相关。",
    insight: "OCR 之前先版面分块，是结构化抽取的关键 trick。",
    trickHint: "加入「Layout-first Chunking」trick，并连接到 fusion retrieval。",
    benefits: ["结构信息保留", "表格独立可检索"],
    costs: ["前处理链路加长"],
    priority: "must_read",
    url: "https://arxiv.org/abs/2604.00002",
    publishedAt: "2026-04-29T05:00:00Z",
    suggestedCollectionId: "ocr-document"
  },
  {
    id: "digest-5",
    topicId: "topic-doc-ai",
    title: "doc-layout-toolkit 升级双栏 PDF 支持",
    contentType: "github_repo",
    source: "github.com",
    summary: "对学术论文与企业报告的双栏版式做了显著优化。",
    whyRecommend: "你之前在 Research Vault 项目用过它，更新值得跟进。",
    insight:
      "不必自研版面模型：成熟工具链 + 少量后处理足以达到 90% 准确率。",
    trickHint: "把它纳入 Sources 列表，对比自研版面解析的边界收益。",
    benefits: ["现成方案", "适配双栏 PDF"],
    costs: ["对手写体仍弱"],
    priority: "optional",
    url: "https://github.com/doc-layout-toolkit/doc-layout-toolkit",
    publishedAt: "2026-04-26T09:00:00Z"
  },
  {
    id: "digest-6",
    topicId: "topic-agents",
    title: "Tool Calling Guardrails 行业落地综述",
    contentType: "report",
    source: "industry report",
    summary:
      "总结 2026 主流 agent 平台的权限模型、参数校验与人在回路设计。",
    whyRecommend:
      "tool-calling-guardrails 卡片可以补充新一批生产级实践。",
    insight: "把权限校验当作独立组件，而不是寄希望于 prompt。",
    trickHint:
      "在已有 guardrails trick 上补一节「权限组件化」与「人在回路阈值」。",
    benefits: ["可审计", "可移植"],
    costs: ["实现复杂度"],
    priority: "recommended",
    url: "https://arxiv.org/abs/2604.00003",
    publishedAt: "2026-04-25T11:00:00Z",
    suggestedCollectionId: "grounding-agents"
  },
  {
    id: "digest-7",
    topicId: "topic-agents",
    title: "Agent Memory: working set vs episodic store",
    contentType: "blog",
    source: "engineering blog",
    summary:
      "把 agent 记忆显式拆成 working set 与 episodic store，避免上下文污染。",
    whyRecommend: "为后续「Agent Memory」专栏埋好引用。",
    insight: "短期记忆走 working set，长期沉淀走结构化 episodic store。",
    trickHint:
      "在新建专栏「Agent Memory」时，把这条经验作为首张 trick 的 problem。",
    benefits: ["上下文更稳", "可回滚"],
    costs: ["架构更复杂"],
    priority: "recommended",
    publishedAt: "2026-04-24T13:00:00Z"
  }
];

const ALL_TOPIC_ID = "__all__";

type DigestCacheEntry = BgCacheEntry;

function formatRelativeTime(iso: string): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const diff = Date.now() - t;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "刚刚";
  if (mins < 60) return `${mins} 分钟前`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} 小时前`;
  const days = Math.floor(hrs / 24);
  return `${days} 天前`;
}

// ========== localStorage 持久化辅助 ==========

const DAILY_PERSIST_KEY = "trick-cards.daily-workspace";

type PersistedDailyState = {
  topics: DigestTopic[];
  hiddenIds: string[];
  deletedIds: string[];
  bookmarkIds: string[];
  readingListIds: string[];
  savedIds: string[];
  readOriginalIds: string[];
  feedback: Record<string, Feedback>;
};

function loadPersistedState(): Partial<PersistedDailyState> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(DAILY_PERSIST_KEY);
    return raw ? (JSON.parse(raw) as Partial<PersistedDailyState>) : {};
  } catch {
    return {};
  }
}

function savePersistedState(state: PersistedDailyState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DAILY_PERSIST_KEY, JSON.stringify(state));
  } catch { /* quota exceeded */ }
}

export function DailyWorkspace() {
  const router = useRouter();
  const { saveCard, savePaper, papers, collections } = useTrickStore();

  const [topics, setTopics] = useState<DigestTopic[]>(initialTopics);
  const [activeTopicId, setActiveTopicId] = useState<string>(ALL_TOPIC_ID);
  const [bookmarkIds, setBookmarkIds] = useState<string[]>([]);
  const [readingListIds, setReadingListIds] = useState<string[]>([]);
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [readOriginalIds, setReadOriginalIds] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<Record<string, Feedback>>({});
  const [topicEditorOpen, setTopicEditorOpen] = useState(false);
  const [editingTopic, setEditingTopic] = useState<DigestTopic | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // 客户端挂载后从 localStorage 恢复持久化数据
  useEffect(() => {
    const saved = loadPersistedState();
    if (saved.topics?.length) setTopics(saved.topics);
    if (saved.hiddenIds?.length) setHiddenIds(saved.hiddenIds);
    if (saved.deletedIds?.length) setDeletedIds(saved.deletedIds);
    if (saved.bookmarkIds?.length) setBookmarkIds(saved.bookmarkIds);
    if (saved.readingListIds?.length) setReadingListIds(saved.readingListIds);
    if (saved.savedIds?.length) setSavedIds(saved.savedIds);
    if (saved.readOriginalIds?.length) setReadOriginalIds(saved.readOriginalIds);
    if (saved.feedback && Object.keys(saved.feedback).length) setFeedback(saved.feedback);
    setHydrated(true);
  }, []);

  // 持久化到 localStorage（仅在 hydration 完成后写入，避免覆盖）
  useEffect(() => {
    if (!hydrated) return;
    savePersistedState({ topics, hiddenIds, deletedIds, bookmarkIds, readingListIds, savedIds, readOriginalIds, feedback });
  }, [topics, hiddenIds, deletedIds, bookmarkIds, readingListIds, savedIds, readOriginalIds, feedback, hydrated]);

  // === 全局后台缓存 state ===
  const [digestCache, setDigestCache] = useState<Record<string, BgCacheEntry>>(getCachedDigests);
  const [errorByTopic, setErrorByTopic] = useState<Record<string, string>>({});
  const [aiConfigured, setAiConfigured] = useState(false);

  // 订阅全局缓存变化（后台拉取完成时通知 UI 刷新）
  useEffect(() => {
    const unsub = subscribeDailyCache(() => {
      setDigestCache(getCachedDigests());
    });
    return unsub;
  }, []);

  // 初次挂载：检查 AI 配置 + 启动每天 6 点自动推送
  useEffect(() => {
    setAiConfigured(isAIConfigComplete(loadAIConfig()));
    const refresh = () =>
      setAiConfigured(isAIConfigComplete(loadAIConfig()));
    window.addEventListener("trick-cards:ai-config-change", refresh);

    // 启动定时自动推送（每天 6:00）
    startDailyScheduler(topics);

    return () => {
      window.removeEventListener("trick-cards:ai-config-change", refresh);
      stopDailyScheduler();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // topics 变化时更新定时器
  useEffect(() => {
    startDailyScheduler(topics);
  }, [topics]);

  useEffect(() => {
    if (!toast) return;
    const handle = window.setTimeout(() => setToast(null), 2400);
    return () => window.clearTimeout(handle);
  }, [toast]);

  /** 切换主题或挂载时，自动尝试拉一次（缓存有效则跳过） */
  useEffect(() => {
    if (activeTopicId === ALL_TOPIC_ID) return;
    const topic = topics.find((t) => t.id === activeTopicId);
    if (!topic) return;
    const p = bgFetchTopic(topic, false);
    if (p) {
      p.catch((err) => {
        setErrorByTopic((e) => ({
          ...e,
          [topic.id]: (err as Error).message || "拉取失败"
        }));
      });
    }
  }, [activeTopicId, topics]);

  /** 当前主题的「重新生成」—— 调用全局后台 fetch，切换页面也不中断 */
  const refreshActive = useCallback(() => {
    if (activeTopicId === ALL_TOPIC_ID) {
      bgFetchAll(topics, true);
      setToast("正在为所有主题拉取最新推送（后台运行，可切换页面）…");
      return;
    }
    const topic = topics.find((t) => t.id === activeTopicId);
    if (!topic) return;
    const p = bgFetchTopic(topic, true);
    if (p) {
      p.catch((err) => {
        setErrorByTopic((e) => ({
          ...e,
          [topic.id]: (err as Error).message || "拉取失败"
        }));
      });
    }
    setToast(`正在为「${topic.name}」拉取最新推送（后台运行）…`);
  }, [activeTopicId, topics]);

  const isAnyLoading = isAnyPending();
  const activeError =
    activeTopicId === ALL_TOPIC_ID
      ? Object.values(errorByTopic).find(Boolean) || null
      : errorByTopic[activeTopicId] || null;

  /** 真实推送（来自全局缓存）。空则 fallback 到 initialCards 作 demo。 */
  const liveCards = useMemo<DigestCard[]>(() => {
    const all = topics.flatMap((t) => (digestCache[t.id]?.cards as DigestCard[]) ?? []);
    return all;
  }, [topics, digestCache]);

  const usingLiveData = liveCards.length > 0;

  const sourceCards = (usingLiveData ? liveCards : initialCards).filter(
    (card) => !deletedIds.includes(card.id)
  );

  // 已在「我的论文」中存在的论文标题集合（小写，用于去重）
  const existingPaperTitles = useMemo(
    () => new Set(papers.map((p) => p.title.trim().toLowerCase())),
    [papers]
  );

  const filteredCards = useMemo(() => {
    return sourceCards
      .filter(
        (card) =>
          activeTopicId === ALL_TOPIC_ID || card.topicId === activeTopicId
      )
      .filter((card) => !hiddenIds.includes(card.id))
      // 自动去重：已生成 Trick / 已点过阅读原文 / 已在我的论文中
      .filter((card) => !savedIds.includes(card.id))
      .filter((card) => !readOriginalIds.includes(card.id))
      .filter(
        (card) =>
          card.contentType !== "paper" ||
          !existingPaperTitles.has(card.title.trim().toLowerCase())
      )
      .sort((a, b) => {
        const order: Record<DigestPriority, number> = {
          must_read: 0,
          recommended: 1,
          optional: 2
        };
        return order[a.priority] - order[b.priority];
      });
  }, [
    sourceCards,
    activeTopicId,
    hiddenIds,
    savedIds,
    readOriginalIds,
    existingPaperTitles
  ]);

  const stats = useMemo(() => {
    const cardsForTopic = sourceCards.filter(
      (card) =>
        activeTopicId === ALL_TOPIC_ID || card.topicId === activeTopicId
    );
    return {
      total: cardsForTopic.length,
      mustRead: cardsForTopic.filter((card) => card.priority === "must_read")
        .length,
      bookmarked: bookmarkIds.length,
      reading: readingListIds.length
    };
  }, [sourceCards, activeTopicId, bookmarkIds, readingListIds]);

  function toggleArray(
    listSetter: React.Dispatch<React.SetStateAction<string[]>>,
    id: string
  ) {
    listSetter((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    );
  }

  function generateTrickFromDigest(card: DigestCard) {
    const fallback = collections[0];
    const collectionId =
      collections.find((c) => c.id === card.suggestedCollectionId)?.id ??
      fallback?.id ??
      "";

    if (!collectionId) {
      window.alert("当前没有可用的专栏，请先在 Collections 页创建一个。");
      return;
    }

    const now = new Date().toISOString();
    const id = `card-daily-${card.id}-${Date.now()}`;

    const next: TrickCard = {
      id,
      title: card.title,
      subtitle: "由 Daily Digest 生成",
      description: card.summary,
      collectionId,
      tags: ["Daily", contentTypeMeta[card.contentType].label],
      domain: "Daily digest",
      status: "todo",
      problem: card.whyRecommend,
      solution: card.insight,
      benefits: card.benefits,
      costs: card.costs,
      tradeoffs: [],
      applicableScenarios: [],
      unsuitableScenarios: [],
      notes: [
        {
          id: `note-${id}`,
          content: `Trick hint: ${card.trickHint}\n来源：${card.source}`,
          createdAt: now
        }
      ],
      sources: [
        {
          id: `source-${id}`,
          title: card.title,
          type: card.contentType === "paper" ? "paper" : "manual",
          note: card.source
        }
      ],
      usages: [],
      relatedCardIds: [],
      images: [],
      createdAt: now,
      updatedAt: now
    };

    saveCard(next);
    setSavedIds((current) =>
      current.includes(card.id) ? current : [...current, card.id]
    );
    setToast(`已生成 Trick：${card.title}`);
  }

  function addToPapers(card: DigestCard) {
    // 检查是否已存在
    if (papers.some((p) => p.title === card.title)) {
      setToast("该论文已在「我的论文」中");
      return;
    }
    const now = new Date().toISOString();
    const paper: Paper = {
      id: `paper-daily-${card.id}-${Date.now()}`,
      title: card.title,
      authors: [],
      venue: card.source,
      abstract: card.summary,
      url: card.url,
      tags: ["Daily"],
      status: "todo",
      notes: "",
      generatedTrickIds: [],
      addedAt: now,
      updatedAt: now
    };
    savePaper(paper);
    setToast(`已加入论文库：${card.title}`);
  }

  function handleFeedback(cardId: string, value: Feedback) {
    setFeedback((current) => ({ ...current, [cardId]: value }));
    if (value === "irrelevant" || value === "seen") {
      setHiddenIds((current) =>
        current.includes(cardId) ? current : [...current, cardId]
      );
    }
  }

  function clearHiddenPermanently() {
    if (!hiddenIds.length) return;
    const idsToDelete = [...hiddenIds];

    deleteCachedDigestCards(idsToDelete);
    setDigestCache(getCachedDigests());
    setDeletedIds((current) => Array.from(new Set([...current, ...idsToDelete])));
    setHiddenIds([]);
    setBookmarkIds((current) => current.filter((id) => !idsToDelete.includes(id)));
    setReadingListIds((current) => current.filter((id) => !idsToDelete.includes(id)));
    setSavedIds((current) => current.filter((id) => !idsToDelete.includes(id)));
    setFeedback((current) => {
      const next = { ...current };
      idsToDelete.forEach((id) => delete next[id]);
      return next;
    });
    setToast("已从本地永久删除隐藏项");
  }

  function openCreateTopic() {
    setEditingTopic(null);
    setTopicEditorOpen(true);
  }

  function openEditTopic(topic: DigestTopic) {
    setEditingTopic(topic);
    setTopicEditorOpen(true);
  }

  function deleteTopic(topic: DigestTopic) {
    if (!window.confirm(`删除主题「${topic.name}」？`)) return;
    setTopics((current) => current.filter((t) => t.id !== topic.id));
    if (activeTopicId === topic.id) {
      setActiveTopicId(ALL_TOPIC_ID);
    }
  }

  function handleTopicSubmit(topic: DigestTopic) {
    setTopics((current) => {
      const exists = current.some((t) => t.id === topic.id);
      return exists
        ? current.map((t) => (t.id === topic.id ? topic : t))
        : [...current, topic];
    });
    setTopicEditorOpen(false);
    setEditingTopic(null);
    setActiveTopicId(topic.id);
  }

  const activeTopicMeta =
    activeTopicId === ALL_TOPIC_ID
      ? null
      : topics.find((t) => t.id === activeTopicId) ?? null;
  const activeCacheEntry =
    activeTopicId === ALL_TOPIC_ID ? null : digestCache[activeTopicId];

  return (
    <DashboardLayout>
      <div className="space-y-2 px-4 py-3 xl:px-6">
        {/* 栏 1：标题 + 主题 tabs（可横滚） + 刷新 */}
        <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-surface px-3 py-1.5 shadow-sm">
          <h2 className="shrink-0 text-xs font-semibold text-text-main">每日推送</h2>
          <span className="h-4 w-px shrink-0 bg-border" />
          <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto scrollbar-thin">
            <TopicsBar
              topics={topics}
              activeTopicId={activeTopicId}
              onChange={setActiveTopicId}
              onEdit={openEditTopic}
              onDelete={deleteTopic}
              onCreate={openCreateTopic}
            />
          </div>
          <button
            type="button"
            onClick={refreshActive}
            disabled={isAnyLoading}
            className="shrink-0 ml-auto flex h-7 items-center gap-1 rounded-lg bg-primary px-2.5 text-xs font-medium text-white disabled:opacity-55"
          >
            {isAnyLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCcw className="h-3 w-3" />}
            {isAnyLoading ? "拉取中…" : "刷新"}
          </button>
        </div>

        {/* 栏 2：统计 + 状态提示 */}
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border/60 bg-surface px-3 py-1 shadow-sm">
          {[
            { label: "推送", value: stats.total, icon: Sunrise, cls: "text-primary" },
            { label: "必读", value: stats.mustRead, icon: Flame, cls: "text-rose-600" },
            { label: "收藏", value: stats.bookmarked, icon: BookmarkPlus, cls: "text-amber-600" },
            { label: "清单", value: stats.reading, icon: ClipboardList, cls: "text-emerald-600" }
          ].map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="flex items-center gap-1.5 text-xs">
                <Icon className={cn("h-3 w-3", s.cls)} />
                <span className="text-slate-500">{s.label}</span>
                <span className="font-semibold text-text-main">{s.value}</span>
              </div>
            );
          })}
        </div>

        <SourceBanner
          aiConfigured={aiConfigured}
          usingLiveData={usingLiveData}
          isLoading={isAnyLoading}
          error={activeError}
          activeTopic={activeTopicMeta}
          cacheEntry={activeCacheEntry ?? undefined}
        />

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
          <section className="space-y-3">
            {filteredCards.length ? (
              filteredCards.map((card) => (
                <DigestCardItem
                  key={card.id}
                  card={card}
                  topic={topics.find((t) => t.id === card.topicId)}
                  bookmarked={bookmarkIds.includes(card.id)}
                  inReadingList={readingListIds.includes(card.id)}
                  saved={savedIds.includes(card.id)}
                  feedback={feedback[card.id]}
                  onBookmark={() => toggleArray(setBookmarkIds, card.id)}
                  onReadingList={() => toggleArray(setReadingListIds, card.id)}
                  onNotInterested={() =>
                    setHiddenIds((current) => [...current, card.id])
                  }
                  onGenerate={() => generateTrickFromDigest(card)}
                  onAddToPapers={() => addToPapers(card)}
                  onReadOriginal={() =>
                    setReadOriginalIds((current) =>
                      current.includes(card.id)
                        ? current
                        : [...current, card.id]
                    )
                  }
                  onViewGraph={() =>
                    router.push(
                      `/agent?q=${encodeURIComponent(card.title)}`
                    )
                  }
                  onFeedback={(value) => handleFeedback(card.id, value)}
                />
              ))
            ) : (
              <EmptyState onCreate={openCreateTopic} />
            )}
          </section>

          <aside className="space-y-4 xl:sticky xl:top-5 xl:self-start">
            <ReadingListPanel
              ids={readingListIds}
              onRemove={(id) =>
                setReadingListIds((current) =>
                  current.filter((item) => item !== id)
                )
              }
              onJump={(id) => {
                const card = sourceCards.find((c) => c.id === id);
                if (card) {
                  setActiveTopicId(card.topicId);
                }
              }}
              cards={sourceCards}
            />
            <BookmarkListPanel
              ids={bookmarkIds}
              onRemove={(id) =>
                setBookmarkIds((current) =>
                  current.filter((item) => item !== id)
                )
              }
              cards={sourceCards}
            />
            <HiddenPanel
              ids={hiddenIds}
              onRestore={(id) =>
                setHiddenIds((current) =>
                  current.filter((item) => item !== id)
                )
              }
              onClear={clearHiddenPermanently}
              cards={sourceCards}
            />
          </aside>
        </div>
      </div>

      {topicEditorOpen ? (
        <TopicEditor
          topic={editingTopic}
          onClose={() => {
            setTopicEditorOpen(false);
            setEditingTopic(null);
          }}
          onSubmit={handleTopicSubmit}
        />
      ) : null}

      {toast ? (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-slate-900 px-4 py-2 text-xs font-medium text-white shadow-panel">
          {toast}
        </div>
      ) : null}
    </DashboardLayout>
  );
}

function TopicsBar({
  topics,
  activeTopicId,
  onChange,
  onEdit,
  onDelete,
  onCreate
}: {
  topics: DigestTopic[];
  activeTopicId: string;
  onChange: (id: string) => void;
  onEdit: (topic: DigestTopic) => void;
  onDelete: (topic: DigestTopic) => void;
  onCreate: () => void;
}) {
  return (
    <>
      <button
        type="button"
        onClick={() => onChange(ALL_TOPIC_ID)}
        className={cn(
          "flex h-7 items-center gap-1 rounded-full border px-2.5 text-xs font-medium transition",
          activeTopicId === ALL_TOPIC_ID
            ? "border-primary bg-primary text-white"
            : "border-border bg-white text-slate-600 hover:border-slate-400"
        )}
      >
        <Inbox className="h-3 w-3" />
        全部
      </button>
      {topics.map((topic) => {
        const active = topic.id === activeTopicId;
        return (
          <div
            key={topic.id}
            className={cn(
              "group flex h-7 items-center gap-0.5 rounded-full border pl-2.5 pr-0.5 text-xs font-medium transition",
              active
                ? "border-primary bg-primary text-white"
                : "border-border bg-white text-slate-600 hover:border-slate-400"
            )}
          >
            <button
              type="button"
              onClick={() => onChange(topic.id)}
              className="flex items-center gap-1"
            >
              <Filter className="h-3 w-3" />
              {topic.name}
              <span
                className={cn(
                  "rounded-full px-1 py-px text-[9px]",
                  active ? "bg-white/20" : "bg-slate-100 text-slate-500"
                )}
              >
                {topic.frequency === "daily" ? "日" : "周"}{topic.pushLimit}
              </span>
            </button>
            <button
              type="button"
              onClick={() => onEdit(topic)}
              aria-label="编辑主题"
              className={cn(
                "flex h-5 w-5 items-center justify-center rounded-full",
                active
                  ? "text-white/80 hover:bg-white/15"
                  : "text-slate-400 hover:bg-slate-100"
              )}
            >
              <Settings2 className="h-2.5 w-2.5" />
            </button>
            <button
              type="button"
              onClick={() => onDelete(topic)}
              aria-label="删除主题"
              className={cn(
                "flex h-5 w-5 items-center justify-center rounded-full",
                active
                  ? "text-white/80 hover:bg-white/15"
                  : "text-slate-400 hover:bg-rose-50 hover:text-rose-600"
              )}
            >
              <Trash2 className="h-2.5 w-2.5" />
            </button>
          </div>
        );
      })}
      <button
        type="button"
        onClick={onCreate}
        className="flex h-7 items-center gap-1 rounded-full border border-dashed border-slate-300 px-2.5 text-xs font-medium text-slate-500 hover:border-primary hover:text-primary"
      >
        <Plus className="h-3 w-3" />
        新建
      </button>
    </>
  );
}

function SourceBanner({
  aiConfigured,
  usingLiveData,
  isLoading,
  error,
  activeTopic,
  cacheEntry
}: {
  aiConfigured: boolean;
  usingLiveData: boolean;
  isLoading: boolean;
  error: string | null;
  activeTopic: DigestTopic | null;
  cacheEntry?: DigestCacheEntry;
}) {
  // 错误优先
  if (error) {
    return (
      <div className="flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs leading-5 text-rose-700">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <span className="font-semibold">拉取失败：</span>
          {error}
          {!aiConfigured ? (
            <span className="ml-1 text-rose-600/80">
              （多数情况下因 API Key 未配置——点右上角钥匙图标设置）
            </span>
          ) : null}
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs leading-5 text-blue-700">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>
          正在从 arXiv 拉取最新论文
          {aiConfigured ? "并用 LLM 生成中文摘要" : ""}…
        </span>
      </div>
    );
  }

  if (!usingLiveData) {
    return (
      <div className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          下面显示的是 <span className="font-semibold">本地 demo 数据</span>。
          点右上角的「
          {activeTopic ? "生成今日推送" : "生成今日推送"}
          」按钮，会基于你订阅的主题从 arXiv 拉真实论文
          {aiConfigured ? "，并用你配置的 LLM 生成中文摘要" : ""}。
          {!aiConfigured ? (
            <span className="ml-1 font-medium">
              未配置 API Key 也能用——只是不会有 LLM 中文摘要。点右上角钥匙图标可配置。
            </span>
          ) : null}
        </div>
      </div>
    );
  }

  // 已用真实数据
  const generatedAt = cacheEntry?.generatedAt;
  const rel = generatedAt ? formatRelativeTime(generatedAt) : "";
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs leading-5 text-emerald-700">
      <CheckCircle2 className="h-4 w-4" />
      <span>
        {activeTopic ? (
          <>
            <span className="font-semibold">{activeTopic.name}</span>
            {generatedAt ? (
              <>
                {" "}
                · {rel}生成（缓存 24 小时）
              </>
            ) : null}
            {!aiConfigured ? (
              <span className="ml-1 text-emerald-700/70">
                未配置 LLM，仅显示原文摘要
              </span>
            ) : null}
          </>
        ) : (
          <>所有主题的真实推送已加载，点「重新生成」可强制刷新</>
        )}
      </span>
    </div>
  );
}

function StatsRow({
  stats
}: {
  stats: { total: number; mustRead: number; bookmarked: number; reading: number };
}) {
  const items = [
    {
      label: "今日推送",
      value: stats.total,
      icon: Sunrise,
      tone: "bg-primary-soft text-primary"
    },
    {
      label: "必读",
      value: stats.mustRead,
      icon: Flame,
      tone: "bg-rose-50 text-rose-700"
    },
    {
      label: "已收藏",
      value: stats.bookmarked,
      icon: BookmarkPlus,
      tone: "bg-amber-50 text-amber-700"
    },
    {
      label: "阅读清单",
      value: stats.reading,
      icon: ClipboardList,
      tone: "bg-emerald-50 text-emerald-700"
    }
  ];
  return (
    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <div
            key={item.label}
            className="rounded-2xl border border-border/80 bg-surface px-4 py-3 shadow-soft"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs text-text-secondary">{item.label}</span>
              <span
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-xl",
                  item.tone
                )}
              >
                <Icon className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-1 text-xl font-semibold text-text-main">
              {item.value}
            </div>
          </div>
        );
      })}
    </section>
  );
}

function DigestCardItem({
  card,
  topic,
  bookmarked,
  inReadingList,
  saved,
  feedback,
  onBookmark,
  onReadingList,
  onNotInterested,
  onGenerate,
  onAddToPapers,
  onReadOriginal,
  onViewGraph,
  onFeedback
}: {
  card: DigestCard;
  topic?: DigestTopic;
  bookmarked: boolean;
  inReadingList: boolean;
  saved: boolean;
  feedback?: Feedback;
  onBookmark: () => void;
  onReadingList: () => void;
  onNotInterested: () => void;
  onGenerate: () => void;
  onAddToPapers: () => void;
  onReadOriginal: () => void;
  onViewGraph: () => void;
  onFeedback: (value: Feedback) => void;
}) {
  const typeMeta = contentTypeMeta[card.contentType];
  const priority = priorityMeta[card.priority];
  const PriorityIcon = priority.icon;

  return (
    <article className="rounded-2xl border border-border/80 bg-surface p-4 shadow-soft">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[11px] font-medium",
              typeMeta.tone
            )}
          >
            {typeMeta.label}
          </span>
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
              priority.tone
            )}
          >
            <PriorityIcon className="h-3 w-3" />
            {priority.label}
          </span>
          {topic ? (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
              {topic.name}
            </span>
          ) : null}
          <span className="text-[11px] text-slate-400">
            {card.source} · {formatDate(card.publishedAt)}
          </span>
        </div>

        <button
          type="button"
          onClick={onNotInterested}
          aria-label="不感兴趣"
          title="不感兴趣"
          className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </header>

      <h3 className="mt-2 text-base font-semibold text-text-main">
        {card.url ? (
          <a
            href={card.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1.5 hover:text-primary hover:underline"
          >
            {card.title}
            <ExternalLink className="inline h-3.5 w-3.5 shrink-0 text-slate-400" />
          </a>
        ) : (
          card.title
        )}
      </h3>
      <p className="mt-1 text-sm leading-6 text-text-secondary">
        {card.summary}
      </p>

      <div className="mt-3 grid gap-2 lg:grid-cols-2">
        <DigestField label="为什么推荐" value={card.whyRecommend} />
        <DigestField label="关键 insight" value={card.insight} accent />
        <DigestField label="可提取 trick" value={card.trickHint} accent />
        <DigestField
          label="收益 / 代价"
          value={`收益：${card.benefits.join("、")}\n代价：${card.costs.join("、")}`}
        />
      </div>

      <footer className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onBookmark}
            className={cn(
              "flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition",
              bookmarked
                ? "border-amber-200 bg-amber-50 text-amber-700"
                : "border-border bg-white text-slate-600 hover:border-slate-400"
            )}
          >
            <BookmarkPlus className="h-3.5 w-3.5" />
            {bookmarked ? "已收藏" : "收藏"}
          </button>

          <button
            type="button"
            onClick={onReadingList}
            className={cn(
              "flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition",
              inReadingList
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-border bg-white text-slate-600 hover:border-slate-400"
            )}
          >
            <ListChecks className="h-3.5 w-3.5" />
            {inReadingList ? "已加入清单" : "加入阅读清单"}
          </button>

          <button
            type="button"
            onClick={onGenerate}
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
                已生成 Trick
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5" />
                生成 Trick Card
              </>
            )}
          </button>

          {card.contentType === "paper" ? (
            <button
              type="button"
              onClick={onAddToPapers}
              className="flex h-8 items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50 px-3 text-xs font-medium text-violet-700 hover:bg-violet-100"
            >
              <BookOpen className="h-3.5 w-3.5" />
              加入我的论文
            </button>
          ) : null}

          {card.url ? (
            <a
              href={card.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                e.stopPropagation();
                onReadOriginal();
              }}
              className="flex h-8 items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 text-xs font-medium text-blue-700 hover:bg-blue-100"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              阅读原文
            </a>
          ) : null}

          <button
            type="button"
            onClick={onViewGraph}
            className="flex h-8 items-center gap-1.5 rounded-full border border-border bg-white px-3 text-xs font-medium text-slate-600 hover:border-slate-400"
          >
            <GitCompareArrows className="h-3.5 w-3.5" />
            查看知识图谱
          </button>
        </div>

      </footer>
    </article>
  );
}

function DigestField({
  label,
  value,
  accent = false
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  const isEmpty = !value || !value.trim() || /^收益：\s*\n代价：\s*$/.test(value);
  return (
    <div
      className={cn(
        "rounded-xl border px-3 py-2 text-xs leading-5",
        accent
          ? "border-primary/20 bg-primary-soft/40 text-text-main"
          : "border-border bg-slate-50 text-slate-700"
      )}
    >
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
        {label}
      </div>
      {isEmpty ? (
        <p className="mt-1 italic text-slate-400">
          未生成（需配置 LLM API Key 后重新生成）
        </p>
      ) : (
        <p className="mt-1 whitespace-pre-line">{value}</p>
      )}
    </div>
  );
}

function FeedbackBar({
  selected,
  onSelect
}: {
  selected?: Feedback;
  onSelect: (value: Feedback) => void;
}) {
  const order: Feedback[] = ["useful", "irrelevant", "too_basic", "too_hard", "seen"];
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[10px] uppercase tracking-[0.16em] text-slate-400">
        反馈
      </span>
      {order.map((key) => {
        const meta = feedbackMeta[key];
        const Icon = meta.icon;
        const active = selected === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onSelect(key)}
            className={cn(
              "flex h-7 items-center gap-1 rounded-full border px-2 text-[11px] transition",
              active
                ? "border-slate-900 bg-slate-900 text-white"
                : meta.tone
            )}
          >
            <Icon className="h-3 w-3" />
            {meta.label}
          </button>
        );
      })}
    </div>
  );
}

function ReadingListPanel({
  ids,
  onRemove,
  onJump,
  cards
}: {
  ids: string[];
  onRemove: (id: string) => void;
  onJump: (id: string) => void;
  cards: DigestCard[];
}) {
  return (
    <section className="rounded-2xl border border-border/80 bg-surface p-4 shadow-soft">
      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-slate-500">
        <ClipboardList className="h-3.5 w-3.5 text-emerald-600" />
        阅读清单（{ids.length}）
      </div>
      {ids.length ? (
        <ul className="mt-2 space-y-1.5 text-xs">
          {ids.map((id) => {
            const card = cards.find((c) => c.id === id);
            if (!card) return null;
            return (
              <li
                key={id}
                className="flex items-center gap-2 rounded-xl border border-border bg-white px-2.5 py-1.5"
              >
                <button
                  type="button"
                  onClick={() => onJump(id)}
                  className="flex-1 truncate text-left text-slate-700"
                >
                  {card.title}
                </button>
                <button
                  type="button"
                  onClick={() => onRemove(id)}
                  aria-label="移出阅读清单"
                  className="text-slate-400 hover:text-rose-600"
                >
                  <X className="h-3 w-3" />
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-2 text-xs text-text-secondary">
          点击「加入阅读清单」收集稍后阅读的内容。
        </p>
      )}
    </section>
  );
}

function BookmarkListPanel({
  ids,
  onRemove,
  cards
}: {
  ids: string[];
  onRemove: (id: string) => void;
  cards: DigestCard[];
}) {
  return (
    <section className="rounded-2xl border border-border/80 bg-surface p-4 shadow-soft">
      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-slate-500">
        <BookmarkPlus className="h-3.5 w-3.5 text-amber-600" />
        收藏夹（{ids.length}）
      </div>
      {ids.length ? (
        <ul className="mt-2 space-y-1.5 text-xs">
          {ids.map((id) => {
            const card = cards.find((c) => c.id === id);
            if (!card) return null;
            return (
              <li
                key={id}
                className="flex items-center gap-2 rounded-xl border border-border bg-white px-2.5 py-1.5"
              >
                <span className="flex-1 truncate text-slate-700">
                  {card.title}
                </span>
                <button
                  type="button"
                  onClick={() => onRemove(id)}
                  aria-label="取消收藏"
                  className="text-slate-400 hover:text-rose-600"
                >
                  <X className="h-3 w-3" />
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-2 text-xs text-text-secondary">
          收藏后会出现在这里，方便沉淀到 Trick Card。
        </p>
      )}
    </section>
  );
}

function HiddenPanel({
  ids,
  onRestore,
  onClear,
  cards
}: {
  ids: string[];
  onRestore: (id: string) => void;
  onClear: () => void;
  cards: DigestCard[];
}) {
  if (!ids.length) return null;
  return (
    <section className="rounded-2xl border border-dashed border-border bg-white p-4 shadow-soft">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-slate-500">
          <ThumbsDown className="h-3.5 w-3.5" />
          已隐藏 ({ids.length})
        </div>
        <button
          type="button"
          onClick={onClear}
          className="flex h-7 items-center gap-1 rounded-full border border-rose-100 bg-rose-50 px-2.5 text-[11px] font-medium text-rose-600 hover:bg-rose-100"
        >
          <Trash2 className="h-3 w-3" />
          清空
        </button>
      </div>
      <ul className="mt-2 space-y-1.5 text-xs">
        {ids.map((id) => {
          const card = cards.find((c) => c.id === id);
          if (!card) return null;
          return (
            <li
              key={id}
              className="flex items-center gap-2 rounded-xl border border-border bg-slate-50 px-2.5 py-1.5"
            >
              <span className="flex-1 truncate text-slate-500 line-through">
                {card.title}
              </span>
              <button
                type="button"
                onClick={() => onRestore(id)}
                className="flex h-6 items-center gap-1 rounded-full border border-border bg-white px-2 text-[11px] text-slate-600"
              >
                <RefreshCcw className="h-3 w-3" />
                恢复
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <section className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-white p-12 text-center shadow-soft">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
        <Sunrise className="h-6 w-6" />
      </div>
      <div>
        <div className="text-base font-semibold text-text-main">
          这里还没有今日推送
        </div>
        <p className="mt-1 text-xs leading-5 text-text-secondary">
          创建主题或选择已有主题，Daily 会按你的关键词与来源生成结构化摘要。
        </p>
      </div>
      <button
        type="button"
        onClick={onCreate}
        className="flex h-9 items-center gap-1.5 rounded-full bg-primary px-4 text-xs font-medium text-white"
      >
        <Plus className="h-3.5 w-3.5" />
        新建主题
      </button>
    </section>
  );
}

function TopicEditor({
  topic,
  onClose,
  onSubmit
}: {
  topic: DigestTopic | null;
  onClose: () => void;
  onSubmit: (topic: DigestTopic) => void;
}) {
  const isEditing = Boolean(topic);
  const [name, setName] = useState(topic?.name ?? "");
  const [keywords, setKeywords] = useState((topic?.keywords ?? []).join(", "));
  const [exclude, setExclude] = useState(
    (topic?.excludeKeywords ?? []).join(", ")
  );
  const [contentTypes, setContentTypes] = useState<DigestContentType[]>(
    topic?.contentTypes ?? ["paper", "github_repo", "blog"]
  );
  const [sources, setSources] = useState((topic?.sources ?? []).join(", "));
  const [venues, setVenues] = useState((topic?.venues ?? []).join(", "));
  const [frequency, setFrequency] = useState<DigestFrequency>(
    topic?.frequency ?? "daily"
  );
  const [pushLimit, setPushLimit] = useState(topic?.pushLimit ?? 5);
  const [difficulty, setDifficulty] = useState<Difficulty>(
    topic?.difficulty ?? "any"
  );
  const [style, setStyle] = useState<DigestStyle>(topic?.style ?? "summary");

  function toggleType(type: DigestContentType) {
    setContentTypes((current) =>
      current.includes(type)
        ? current.filter((value) => value !== type)
        : [...current, type]
    );
  }

  function handleSubmit() {
    if (!name.trim()) {
      window.alert("请填写主题名称");
      return;
    }

    const next: DigestTopic = {
      id: topic?.id ?? `topic-${Date.now()}`,
      name: name.trim(),
      keywords: keywords
        .split(/[，,]/)
        .map((value) => value.trim())
        .filter(Boolean),
      excludeKeywords: exclude
        .split(/[，,]/)
        .map((value) => value.trim())
        .filter(Boolean),
      contentTypes,
      sources: sources
        .split(/[，,]/)
        .map((value) => value.trim())
        .filter(Boolean),
      venues: venues
        .split(/[，,]/)
        .map((value) => value.trim())
        .filter(Boolean),
      frequency,
      pushLimit,
      difficulty,
      style
    };

    onSubmit(next);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-6">
      <div className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-3xl bg-surface shadow-panel">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div>
            <div className="text-[10px] font-semibold tracking-[0.18em] text-slate-500">
              {isEditing ? "编辑主题" : "新建主题"}
            </div>
            <h2 className="mt-1 text-base font-semibold text-text-main">
              {isEditing ? "编辑订阅主题" : "新建订阅主题"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-border text-slate-500"
            aria-label="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 overflow-y-auto p-5">
          <Field label="主题名称">
            <input
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="例如：Multimodal RAG"
              className={fieldInput}
            />
          </Field>

          <div className="grid gap-3 md:grid-cols-2">
            <Field label="关注关键词（逗号分隔）">
              <input
                value={keywords}
                onChange={(event) => setKeywords(event.target.value)}
                placeholder="multimodal, rag, vlm"
                className={fieldInput}
              />
            </Field>
            <Field label="排除关键词">
              <input
                value={exclude}
                onChange={(event) => setExclude(event.target.value)}
                placeholder="chatbot demo"
                className={fieldInput}
              />
            </Field>
          </div>

          <Field label="内容类型">
            <div className="flex flex-wrap gap-1.5">
              {(["paper", "github_repo", "blog"] as DigestContentType[]).map(
                (type) => {
                  const active = contentTypes.includes(type);
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => toggleType(type)}
                      className={cn(
                        "flex h-7 items-center gap-1 rounded-full border px-2.5 text-xs font-medium transition",
                        active
                          ? "border-primary bg-primary text-white"
                          : "border-border bg-white text-slate-600 hover:border-slate-400"
                      )}
                    >
                      {contentTypeMeta[type].label}
                    </button>
                  );
                }
              )}
            </div>
          </Field>

          {contentTypes.includes("paper") ? (
            <Field label="期刊 / 会议偏好（逗号分隔，留空=不限）">
              <input
                value={venues}
                onChange={(event) => setVenues(event.target.value)}
                placeholder="IEEE, ISSCC, CVPR, ACM, Nature, JSSC"
                className={fieldInput}
              />
              <div className="mt-1 text-[10px] text-slate-400">
                指定后仅搜索这些期刊/会议的论文（通过 Semantic Scholar），可过滤水刊
              </div>
            </Field>
          ) : null}

          <div className="grid gap-3 md:grid-cols-2">
            <Field label="推送频率">
              <select
                className={fieldInput}
                value={frequency}
                onChange={(event) =>
                  setFrequency(event.target.value as DigestFrequency)
                }
              >
                <option value="daily">每日</option>
                <option value="weekly">每周</option>
              </select>
            </Field>
            <Field label="每次条数">
              <input
                type="number"
                min={1}
                max={20}
                value={pushLimit}
                onChange={(event) =>
                  setPushLimit(Number(event.target.value) || 1)
                }
                className={fieldInput}
              />
            </Field>
          </div>

          <Field label="内容风格">
            <select
              className={fieldInput}
              value={style}
              onChange={(event) => setStyle(event.target.value as DigestStyle)}
            >
              <option value="summary">摘要型</option>
              <option value="deep_dive">深度型</option>
              <option value="headline">标题型</option>
            </select>
          </Field>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 items-center justify-center rounded-xl border border-border bg-white px-3 text-xs font-medium text-slate-600"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="flex h-9 items-center justify-center rounded-xl bg-primary px-4 text-xs font-medium text-white"
          >
            {isEditing ? "保存修改" : "创建主题"}
          </button>
        </div>
      </div>
    </div>
  );
}

const fieldInput =
  "w-full rounded-xl border border-border bg-white px-3 py-2 text-sm text-text-main outline-none focus:border-primary";

function Field({
  label,
  children
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
        {label}
      </div>
      {children}
    </label>
  );
}
