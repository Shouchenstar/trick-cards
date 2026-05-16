/**
 * 全局每日推送缓存 —— 在页面切换时保留拉取状态，支持后台运行和定时自动刷新。
 */

import { callDailyDigest } from "@/lib/ai/client-bridge";
import type { DailyDigest, DailyDigestItem } from "@/lib/ai/types";

// ========== 类型 ==========

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

type DigestFrequency = "daily" | "weekly";
type Difficulty = "easy" | "medium" | "hard" | "any";
type DigestStyle = "summary" | "deep_dive" | "headline";
type DigestPriority = "must_read" | "recommended" | "optional";

export type DigestTopic = {
  id: string;
  name: string;
  keywords: string[];
  excludeKeywords: string[];
  contentTypes: DigestContentType[];
  sources: string[];
  venues: string[];
  frequency: DigestFrequency;
  pushLimit: number;
  difficulty: Difficulty;
  style: DigestStyle;
};

export type DigestCard = {
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

export type DigestCacheEntry = {
  generatedAt: string;
  cards: DigestCard[];
};

export type DigestCacheMap = Record<string, DigestCacheEntry>;

// ========== 缓存 & 状态 ==========

const DIGEST_STORAGE_KEY = "trick-cards.daily-digest-cache.v2";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const AUTO_PUSH_HOUR = 6; // 每天早上 6 点自动刷新
const AUTO_PUSH_STORAGE_KEY = "trick-cards.daily-auto-push-date";

let pendingFetches: Record<string, Promise<DigestCacheEntry>> = {};
let listeners: Array<() => void> = [];
let schedulerTimer: ReturnType<typeof setTimeout> | null = null;

// ========== localStorage 持久化 ==========

function loadCache(): DigestCacheMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(DIGEST_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as DigestCacheMap) : {};
  } catch {
    return {};
  }
}

function saveCache(cache: DigestCacheMap) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DIGEST_STORAGE_KEY, JSON.stringify(cache));
  } catch {
    /* quota exceeded */
  }
}

export function isCacheFresh(entry?: DigestCacheEntry): boolean {
  if (!entry) return false;
  const t = Date.parse(entry.generatedAt);
  return Number.isFinite(t) && Date.now() - t < CACHE_TTL_MS;
}

// ========== 订阅机制（让组件感知后台变化）==========

export function subscribe(fn: () => void) {
  listeners.push(fn);
  return () => {
    listeners = listeners.filter((l) => l !== fn);
  };
}

function notify() {
  listeners.forEach((fn) => fn());
}

// ========== 查询 ==========

export function getCachedDigests(): DigestCacheMap {
  return loadCache();
}

export function deleteCachedDigestCards(cardIds: string[]) {
  if (!cardIds.length) return;
  const idSet = new Set(cardIds);
  const cache = loadCache();
  let changed = false;

  for (const [topicId, entry] of Object.entries(cache)) {
    const cards = entry.cards.filter((card) => !idSet.has(card.id));
    if (cards.length !== entry.cards.length) {
      cache[topicId] = { ...entry, cards };
      changed = true;
    }
  }

  if (changed) {
    saveCache(cache);
    notify();
  }
}

export function isPending(topicId: string): boolean {
  return topicId in pendingFetches;
}

export function isAnyPending(): boolean {
  return Object.keys(pendingFetches).length > 0;
}

// ========== 数据适配 ==========

function buildTopicQuery(topic: DigestTopic): string {
  const kw = topic.keywords.filter(Boolean);
  const exclude = topic.excludeKeywords.filter(Boolean).map((k) => `-${k}`);
  const tokens = [...kw, ...exclude];
  return tokens.length ? tokens.join(" ") : topic.name;
}

function adaptItemToCard(
  item: DailyDigestItem,
  topicId: string,
  index: number
): DigestCard {
  const paper = item.paper;
  const abstract = paper.abstract ?? "";
  const summary =
    item.summary ||
    (abstract.length > 220 ? `${abstract.slice(0, 220)}…` : abstract);
  return {
    id: `digest-${topicId}-${paper.id}`,
    topicId,
    title: paper.title,
    contentType: "paper",
    source: paper.venue || "arXiv",
    summary,
    whyRecommend: item.whyRead || "",
    insight: item.insight || "",
    trickHint: item.trickHint || "",
    benefits: Array.isArray(item.benefits) ? item.benefits : [],
    costs: Array.isArray(item.costs) ? item.costs : [],
    priority:
      index === 0 ? "must_read" : index < 3 ? "recommended" : "optional",
    relatedKeywords: paper.primaryCategory ? [paper.primaryCategory] : [],
    url: paper.url,
    publishedAt: paper.published || paper.updated || new Date().toISOString()
  };
}

// ========== 核心：后台拉取 ==========

/**
 * 为某个主题拉取推送。返回 Promise，即使切换页面也不会中断。
 * force = true 跳过缓存。
 */
export function fetchTopicDigest(
  topic: DigestTopic,
  force = false
): Promise<DigestCacheEntry> | null {
  const cache = loadCache();

  // 缓存有效且非强制 → 跳过
  if (!force && isCacheFresh(cache[topic.id])) return null;

  // 已有正在进行的请求 → 返回同一个 Promise
  if (topic.id in pendingFetches) return pendingFetches[topic.id];

  const promise = (async () => {
    const query = buildTopicQuery(topic);
    const maxItems = Math.min(Math.max(topic.pushLimit || 5, 1), 12);
    const digest = await callDailyDigest(query, {
      maxItems,
      venues: topic.venues?.length ? topic.venues : undefined
    });
    const cards = digest.items.map((item, idx) =>
      adaptItemToCard(item, topic.id, idx)
    );
    const entry: DigestCacheEntry = {
      generatedAt: digest.generatedAt || new Date().toISOString(),
      cards
    };

    // 写入 localStorage
    const current = loadCache();
    current[topic.id] = entry;
    saveCache(current);

    return entry;
  })();

  // 完成后清理
  const cleanup = () => {
    delete pendingFetches[topic.id];
    notify();
  };
  promise.then(cleanup, cleanup);

  pendingFetches[topic.id] = promise;
  notify();
  return promise;
}

/**
 * 批量刷新所有主题。
 */
export function fetchAllTopics(topics: DigestTopic[], force = false) {
  topics.forEach((topic) => fetchTopicDigest(topic, force));
}

// ========== 定时自动推送（每天早上 6 点）==========

function getLastAutoPushDate(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(AUTO_PUSH_STORAGE_KEY);
}

function setLastAutoPushDate(dateStr: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(AUTO_PUSH_STORAGE_KEY, dateStr);
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
}

function msUntilNextPush(): number {
  const now = new Date();
  const target = new Date(now);
  target.setHours(AUTO_PUSH_HOUR, 0, 0, 0);
  if (now >= target) {
    // 今天的 6 点已过，定到明天
    target.setDate(target.getDate() + 1);
  }
  return target.getTime() - now.getTime();
}

/**
 * 启动自动定时推送。传入当前主题列表。
 * 应在应用初始化时调用一次。多次调用安全（会清除旧定时器）。
 */
export function startDailyScheduler(topics: DigestTopic[]) {
  if (typeof window === "undefined") return;

  // 清除旧定时器
  if (schedulerTimer !== null) {
    clearTimeout(schedulerTimer);
    schedulerTimer = null;
  }

  // 先检查今天有没有推送过
  const last = getLastAutoPushDate();
  const today = todayStr();
  const now = new Date();
  const pastPushTime = now.getHours() >= AUTO_PUSH_HOUR;

  if (pastPushTime && last !== today) {
    // 今天 6 点已过但尚未自动推送 → 立即执行
    setLastAutoPushDate(today);
    fetchAllTopics(topics, true);
  }

  // 设置定时器到下一个 6:00
  const ms = msUntilNextPush();
  schedulerTimer = setTimeout(() => {
    setLastAutoPushDate(todayStr());
    fetchAllTopics(topics, true);
    // 递归设置下一次
    startDailyScheduler(topics);
  }, ms);
}

export function stopDailyScheduler() {
  if (schedulerTimer !== null) {
    clearTimeout(schedulerTimer);
    schedulerTimer = null;
  }
}
