"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownUp,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  Download,
  ExternalLink,
  Eye,
  FileText,
  Inbox,
  Link2,
  Loader2,
  Pencil,
  Plus,
  Save,
  Sparkles,
  Star,
  Trash2,
  X
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { TopBar } from "@/components/layout/TopBar";
import { useTrickStore } from "@/lib/store/TrickStore";
import { Collection, Paper, PaperStatus, TrickCard } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";
import { callImportPaper } from "@/lib/ai/client-bridge";

type StatusFilter = PaperStatus | "all";

const statusMeta: Record<
  PaperStatus,
  { label: string; tone: string; dot: string; icon: LucideIcon }
> = {
  todo: {
    label: "待读",
    tone: "bg-amber-50 text-amber-700 border-amber-200",
    dot: "bg-amber-500",
    icon: Inbox
  },
  reading: {
    label: "阅读中",
    tone: "bg-sky-50 text-sky-700 border-sky-200",
    dot: "bg-sky-500",
    icon: Eye
  },
  read: {
    label: "已读",
    tone: "bg-emerald-50 text-emerald-700 border-emerald-200",
    dot: "bg-emerald-500",
    icon: CheckCircle2
  },
  shelved: {
    label: "已搁置",
    tone: "bg-slate-100 text-slate-600 border-slate-200",
    dot: "bg-slate-400",
    icon: ClipboardList
  }
};

const statusOrder: PaperStatus[] = ["todo", "reading", "read", "shelved"];

const inputClass =
  "w-full rounded-xl border border-border bg-white px-3 py-2 text-sm text-text-main outline-none focus:border-primary";

function generateId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function PapersWorkspace() {
  const router = useRouter();
  const {
    papers,
    collections,
    cards,
    storageReady,
    savePaper,
    deletePaper,
    setPaperStatus,
    saveCard,
    linkTrickToPaper,
    unlinkTrickFromPaper
  } = useTrickStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [activeTag, setActiveTag] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<string>("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingPaper, setEditingPaper] = useState<Paper | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [draftNotes, setDraftNotes] = useState("");
  const [notesDirty, setNotesDirty] = useState(false);
  const [sortByRating, setSortByRating] = useState(false);

  useEffect(() => {
    if (!toast) return;
    const handle = window.setTimeout(() => setToast(null), 2400);
    return () => window.clearTimeout(handle);
  }, [toast]);

  useEffect(() => {
    if (storageReady && !selectedId && papers.length) {
      setSelectedId(papers[0].id);
    }
  }, [storageReady, selectedId, papers]);

  const collectionMap = useMemo(
    () => new Map(collections.map((c) => [c.id, c])),
    [collections]
  );

  const cardMap = useMemo(
    () => new Map(cards.map((card) => [card.id, card])),
    [cards]
  );

  const availableTags = useMemo(() => {
    return Array.from(new Set(papers.flatMap((paper) => paper.tags))).sort(
      (a, b) => a.localeCompare(b)
    );
  }, [papers]);

  const filteredPapers = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    return papers
      .filter((paper) => {
        if (statusFilter !== "all" && paper.status !== statusFilter) {
          return false;
        }
        if (activeTag !== "all" && !paper.tags.includes(activeTag)) {
          return false;
        }
        if (normalizedQuery) {
          const haystack = [
            paper.title,
            paper.authors.join(" "),
            paper.venue ?? "",
            paper.abstract ?? "",
            paper.tags.join(" "),
            paper.notes
          ]
            .join(" ")
            .toLowerCase();
          if (!haystack.includes(normalizedQuery)) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => {
        if (sortByRating) {
          return (b.rating ?? 0) - (a.rating ?? 0);
        }
        const orderA = statusOrder.indexOf(a.status);
        const orderB = statusOrder.indexOf(b.status);
        if (orderA !== orderB) {
          return orderA - orderB;
        }
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
  }, [papers, statusFilter, activeTag, searchQuery, sortByRating]);

  const selectedPaper = useMemo(
    () => papers.find((paper) => paper.id === selectedId) ?? null,
    [papers, selectedId]
  );

  useEffect(() => {
    setDraftNotes(selectedPaper?.notes ?? "");
    setNotesDirty(false);
  }, [selectedPaper?.id, selectedPaper?.notes]);

  const stats = useMemo(() => {
    const counts: Record<PaperStatus, number> = {
      todo: 0,
      reading: 0,
      read: 0,
      shelved: 0
    };
    for (const paper of papers) {
      counts[paper.status] += 1;
    }
    const generated = papers.reduce(
      (sum, paper) => sum + paper.generatedTrickIds.length,
      0
    );
    return {
      total: papers.length,
      ...counts,
      generated
    };
  }, [papers]);

  function openCreateEditor() {
    setEditingPaper(null);
    setEditorOpen(true);
  }

  function openEditEditor(paper: Paper) {
    setEditingPaper(paper);
    setEditorOpen(true);
  }

  function closeEditor() {
    setEditorOpen(false);
    setEditingPaper(null);
  }

  function handleSubmit(paper: Paper) {
    savePaper(paper);
    setSelectedId(paper.id);
    setToast(editingPaper ? `已保存「${paper.title}」` : `已添加「${paper.title}」`);
    closeEditor();
  }

  function handleDelete(paper: Paper) {
    if (!window.confirm(`删除论文「${paper.title}」？`)) {
      return;
    }
    deletePaper(paper.id);
    if (selectedId === paper.id) {
      setSelectedId("");
    }
    setToast(`已删除「${paper.title}」`);
  }

  function saveNotes() {
    if (!selectedPaper || !notesDirty) return;
    savePaper({ ...selectedPaper, notes: draftNotes });
    setNotesDirty(false);
    setToast("笔记已保存");
  }

  function handleRating(paper: Paper, rating: number) {
    savePaper({ ...paper, rating });
  }

  function handleStatus(paper: Paper, status: PaperStatus) {
    setPaperStatus(paper.id, status);
  }

  function generateTrickFromPaper(paper: Paper) {
    const fallback = collections[0];
    const collectionId =
      collections.find((c) => c.id === paper.collectionId)?.id ??
      fallback?.id ??
      "";

    if (!collectionId) {
      window.alert("当前没有可用的专栏，请先在专栏管理页创建一个。");
      return;
    }

    const now = new Date().toISOString();
    const id = generateId(`card-paper-${paper.id}`);

    const next: TrickCard = {
      id,
      title: paper.title,
      subtitle: paper.venue
        ? `${paper.venue}${paper.year ? ` · ${paper.year}` : ""}`
        : "由论文生成",
      description:
        paper.abstract?.trim() || "由论文一键生成的 trick，请补充结构化字段。",
      collectionId,
      tags: ["论文", ...paper.tags].slice(0, 6),
      domain: paper.venue,
      status: "todo",
      problem: paper.abstract?.trim() || "（待补充）",
      solution: paper.notes?.trim() || "（待补充：在论文中提炼出的核心做法）",
      benefits: [],
      costs: [],
      tradeoffs: [],
      applicableScenarios: [],
      unsuitableScenarios: [],
      notes: paper.notes
        ? [
            {
              id: generateId("note"),
              content: paper.notes,
              createdAt: now
            }
          ]
        : [],
      sources: [
        {
          id: generateId("source"),
          title: paper.title,
          type: "paper",
          url: paper.url,
          authors: paper.authors,
          venue: paper.venue,
          year: paper.year
        }
      ],
      usages: [],
      relatedCardIds: [],
      images: [],
      createdAt: now,
      updatedAt: now
    };

    saveCard(next);
    linkTrickToPaper(paper.id, id);
    setToast(`已生成卡片：${next.title}`);
  }

  return (
    <DashboardLayout>
      <TopBar
        title="论文管理"
        subtitle="把读到的论文沉淀进结构化卡片：管理状态、笔记、评分与关联。"
        eyebrow="论文"
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="搜索标题、作者、摘要或笔记"
        primaryAction={{
          label: "新增论文",
          icon: Plus,
          onClick: openCreateEditor
        }}
        secondaryAction={{
          label: "去卡片墙",
          icon: ArrowRight,
          onClick: () => router.push("/cards")
        }}
      />

      <div className="space-y-5 px-5 py-5 xl:px-8">
        <StatsRow stats={stats} />

        <FilterBar
          statusFilter={statusFilter}
          onStatusChange={setStatusFilter}
          activeTag={activeTag}
          onTagChange={setActiveTag}
          availableTags={availableTags}
          totalCount={filteredPapers.length}
          sortByRating={sortByRating}
          onToggleSortByRating={() => setSortByRating((v) => !v)}
        />

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <div className="rounded-2xl border border-border/80 bg-surface p-3 shadow-soft">
            {filteredPapers.length ? (
              <ul className="space-y-2">
                {filteredPapers.map((paper) => (
                  <PaperListItem
                    key={paper.id}
                    paper={paper}
                    selected={paper.id === selectedId}
                    collection={
                      paper.collectionId
                        ? collectionMap.get(paper.collectionId)
                        : undefined
                    }
                    onSelect={() => setSelectedId(paper.id)}
                  />
                ))}
              </ul>
            ) : (
              <EmptyListState onCreate={openCreateEditor} />
            )}
          </div>

          <div className="xl:sticky xl:top-5 xl:max-h-[calc(100vh-2rem)] xl:self-start xl:overflow-y-auto xl:overflow-x-hidden scrollbar-thin">
            {selectedPaper ? (
              <PaperDetail
                paper={selectedPaper}
                collection={
                  selectedPaper.collectionId
                    ? collectionMap.get(selectedPaper.collectionId)
                    : undefined
                }
                cardMap={cardMap}
                draftNotes={draftNotes}
                notesDirty={notesDirty}
                onChangeNotes={(value) => {
                  setDraftNotes(value);
                  setNotesDirty(value !== (selectedPaper.notes ?? ""));
                }}
                onSaveNotes={saveNotes}
                onEdit={() => openEditEditor(selectedPaper)}
                onDelete={() => handleDelete(selectedPaper)}
                onChangeStatus={(status) => handleStatus(selectedPaper, status)}
                onChangeRating={(rating) =>
                  handleRating(selectedPaper, rating)
                }
                onGenerate={() => generateTrickFromPaper(selectedPaper)}
                onJumpCard={(cardId) => {
                  router.push("/cards");
                  setToast(`已跳转到卡片墙，请查看「${cardMap.get(cardId)?.title ?? "目标卡片"}」`);
                }}
                onLinkTrick={(cardId) => {
                  linkTrickToPaper(selectedPaper.id, cardId);
                  setToast(`已关联卡片「${cardMap.get(cardId)?.title ?? cardId}」`);
                }}
                onUnlinkTrick={(cardId) => {
                  unlinkTrickFromPaper(selectedPaper.id, cardId);
                  setToast(`已取消关联「${cardMap.get(cardId)?.title ?? cardId}」`);
                }}
              />
            ) : (
              <EmptyDetailState onCreate={openCreateEditor} />
            )}
          </div>
        </section>
      </div>

      {editorOpen ? (
        <PaperEditor
          paper={editingPaper}
          collections={collections}
          onClose={closeEditor}
          onSubmit={handleSubmit}
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

function StatsRow({
  stats
}: {
  stats: {
    total: number;
    todo: number;
    reading: number;
    read: number;
    shelved: number;
    generated: number;
  };
}) {
  const items: Array<{
    label: string;
    value: number;
    icon: LucideIcon;
    tone: string;
  }> = [
    {
      label: "全部",
      value: stats.total,
      icon: BookOpen,
      tone: "bg-primary-soft text-primary"
    },
    {
      label: "待读",
      value: stats.todo,
      icon: Inbox,
      tone: "bg-amber-50 text-amber-700"
    },
    {
      label: "阅读中",
      value: stats.reading,
      icon: Eye,
      tone: "bg-sky-50 text-sky-700"
    },
    {
      label: "已读",
      value: stats.read,
      icon: CheckCircle2,
      tone: "bg-emerald-50 text-emerald-700"
    }
  ];

  return (
    <section className="flex flex-wrap items-center gap-4 rounded-xl border border-border/60 bg-surface px-4 py-2 shadow-sm">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <div key={item.label} className="flex items-center gap-2">
            <span
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-md",
                item.tone
              )}
            >
              <Icon className="h-3.5 w-3.5" />
            </span>
            <span className="text-xs text-text-secondary">{item.label}</span>
            <span className="text-sm font-semibold text-text-main">
              {item.value}
            </span>
          </div>
        );
      })}
    </section>
  );
}

function FilterBar({
  statusFilter,
  onStatusChange,
  activeTag,
  onTagChange,
  availableTags,
  totalCount,
  sortByRating,
  onToggleSortByRating
}: {
  statusFilter: StatusFilter;
  onStatusChange: (next: StatusFilter) => void;
  activeTag: string;
  onTagChange: (next: string) => void;
  availableTags: string[];
  totalCount: number;
  sortByRating: boolean;
  onToggleSortByRating: () => void;
}) {
  return (
    <section className="rounded-2xl border border-border/80 bg-surface p-4 shadow-soft">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onStatusChange("all")}
            className={cn(
              "flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition",
              statusFilter === "all"
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-border bg-white text-slate-600 hover:border-slate-400"
            )}
          >
            全部状态
          </button>
          {statusOrder.map((status) => {
            const meta = statusMeta[status];
            const StatusIcon = meta.icon;
            const active = statusFilter === status;
            return (
              <button
                key={status}
                type="button"
                onClick={() => onStatusChange(status)}
                className={cn(
                  "flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition",
                  active
                    ? "border-primary bg-primary text-white"
                    : "border-border bg-white text-slate-600 hover:border-slate-400"
                )}
              >
                <StatusIcon className="h-3.5 w-3.5" />
                {meta.label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="flex h-9 items-center gap-2 rounded-xl border border-border bg-white px-3">
            <span className="text-xs text-slate-500">标签</span>
            <select
              className="h-8 min-w-[120px] bg-transparent text-xs text-text-main outline-none"
              value={activeTag}
              onChange={(event) => onTagChange(event.target.value)}
            >
              <option value="all">全部标签</option>
              {availableTags.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={onToggleSortByRating}
            className={cn(
              "flex h-9 items-center gap-1.5 rounded-xl border px-3 text-xs font-medium transition",
              sortByRating
                ? "border-amber-300 bg-amber-50 text-amber-700"
                : "border-border bg-white text-slate-600 hover:border-slate-400"
            )}
          >
            <ArrowDownUp className="h-3.5 w-3.5" />
            {sortByRating ? "按星级排序" : "按星级排序"}
          </button>
          <span className="rounded-full bg-primary-soft px-3 py-1 text-[11px] font-medium text-primary">
            匹配 {totalCount} 篇
          </span>
        </div>
      </div>
    </section>
  );
}

function PaperListItem({
  paper,
  selected,
  collection,
  onSelect
}: {
  paper: Paper;
  selected: boolean;
  collection?: Collection;
  onSelect: () => void;
}) {
  const meta = statusMeta[paper.status];

  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          "flex w-full flex-col gap-2 rounded-2xl border p-3 text-left transition",
          selected
            ? "border-primary bg-primary-soft/40"
            : "border-border bg-white hover:border-slate-400"
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium",
                  meta.tone
                )}
              >
                <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
                {meta.label}
              </span>
              {collection ? (
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
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
            <div className="mt-1.5 line-clamp-2 text-sm font-semibold text-text-main">
              {paper.title}
            </div>
            <div className="mt-1 line-clamp-1 text-[11px] text-text-secondary">
              {paper.authors.join("、") || "未填作者"}
              {paper.venue ? ` · ${paper.venue}` : ""}
              {paper.year ? ` · ${paper.year}` : ""}
            </div>
          </div>

          {typeof paper.rating === "number" ? (
            <div className="flex shrink-0 items-center gap-0.5 text-amber-500">
              {Array.from({ length: 5 }).map((_, index) => (
                <Star
                  key={index}
                  className={cn(
                    "h-3.5 w-3.5",
                    index < (paper.rating ?? 0) ? "fill-amber-400" : "opacity-30"
                  )}
                />
              ))}
            </div>
          ) : null}
        </div>

        {paper.tags.length ? (
          <div className="flex flex-wrap gap-1">
            {paper.tags.slice(0, 4).map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600"
              >
                {tag}
              </span>
            ))}
          </div>
        ) : null}
      </button>
    </li>
  );
}

function PaperDetail({
  paper,
  collection,
  cardMap,
  draftNotes,
  notesDirty,
  onChangeNotes,
  onSaveNotes,
  onEdit,
  onDelete,
  onChangeStatus,
  onChangeRating,
  onGenerate,
  onJumpCard,
  onLinkTrick,
  onUnlinkTrick
}: {
  paper: Paper;
  collection?: Collection;
  cardMap: Map<string, TrickCard>;
  draftNotes: string;
  notesDirty: boolean;
  onChangeNotes: (value: string) => void;
  onSaveNotes: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onChangeStatus: (status: PaperStatus) => void;
  onChangeRating: (rating: number) => void;
  onGenerate: () => void;
  onJumpCard: (cardId: string) => void;
  onLinkTrick: (cardId: string) => void;
  onUnlinkTrick: (cardId: string) => void;
}) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkSearch, setLinkSearch] = useState("");
  return (
    <article className="rounded-2xl border border-border/80 bg-surface p-5 shadow-soft">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {collection ? (
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
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
            <span className="text-[10px] text-slate-500">
              添加于 {formatDate(paper.addedAt)}
            </span>
          </div>
          <h2 className="mt-2 text-lg font-semibold text-text-main">
            {paper.title}
          </h2>
          <div className="mt-1 text-xs text-text-secondary">
            {paper.authors.join("、") || "未填作者"}
            {paper.venue ? ` · ${paper.venue}` : ""}
            {paper.year ? ` · ${paper.year}` : ""}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {paper.url ? (
            <a
              href={paper.url}
              target="_blank"
              rel="noreferrer"
              className="flex h-9 items-center gap-1.5 rounded-xl border border-border bg-white px-3 text-xs font-medium text-slate-600"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              打开链接
            </a>
          ) : null}
          <button
            type="button"
            onClick={onEdit}
            className="flex h-9 items-center gap-1.5 rounded-xl border border-border bg-white px-3 text-xs font-medium text-slate-600"
          >
            <Pencil className="h-3.5 w-3.5" />
            编辑
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-white text-danger"
            aria-label="删除论文"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </header>

      <section className="mt-4 grid gap-3 lg:grid-cols-2">
        <div>
          <div className="text-[10px] font-semibold tracking-[0.16em] text-slate-500">
            阅读状态
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {statusOrder.map((status) => {
              const meta = statusMeta[status];
              const StatusIcon = meta.icon;
              const active = paper.status === status;
              return (
                <button
                  key={status}
                  type="button"
                  onClick={() => onChangeStatus(status)}
                  className={cn(
                    "flex h-7 items-center gap-1 rounded-full border px-2.5 text-[11px] font-medium transition",
                    active
                      ? "border-slate-900 bg-slate-900 text-white"
                      : meta.tone
                  )}
                >
                  <StatusIcon className="h-3 w-3" />
                  {meta.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="text-[10px] font-semibold tracking-[0.16em] text-slate-500">
            评分
          </div>
          <div className="mt-2 flex items-center gap-1">
            {Array.from({ length: 5 }).map((_, index) => {
              const value = index + 1;
              const active = (paper.rating ?? 0) >= value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => onChangeRating(active && paper.rating === value ? value - 1 : value)}
                  aria-label={`评分 ${value} 星`}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-amber-500 hover:bg-amber-50"
                >
                  <Star
                    className={cn(
                      "h-4 w-4",
                      active ? "fill-amber-400" : "opacity-40"
                    )}
                  />
                </button>
              );
            })}
            <span className="ml-2 text-[11px] text-slate-500">
              {paper.rating ? `${paper.rating} / 5` : "暂未评分"}
            </span>
          </div>
        </div>
      </section>

      {paper.abstract ? (
        <section className="mt-4">
          <div className="text-[10px] font-semibold tracking-[0.16em] text-slate-500">
            摘要
          </div>
          <p className="mt-1.5 whitespace-pre-line text-sm leading-6 text-slate-700">
            {paper.abstract}
          </p>
        </section>
      ) : null}

      {paper.tags.length ? (
        <section className="mt-4">
          <div className="text-[10px] font-semibold tracking-[0.16em] text-slate-500">
            标签
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {paper.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600"
              >
                {tag}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mt-4">
        <div className="flex items-center justify-between">
          <div className="text-[10px] font-semibold tracking-[0.16em] text-slate-500">
            阅读笔记
          </div>
          <button
            type="button"
            onClick={onSaveNotes}
            disabled={!notesDirty}
            className="flex h-7 items-center gap-1.5 rounded-full border border-border bg-white px-2.5 text-[11px] font-medium text-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save className="h-3 w-3" />
            {notesDirty ? "保存笔记" : "已保存"}
          </button>
        </div>
        <textarea
          value={draftNotes}
          onChange={(event) => onChangeNotes(event.target.value)}
          placeholder="记录关键点、可提取的 trick、与已有卡片的关系……"
          className="mt-1.5 h-32 w-full resize-none rounded-xl border border-border bg-white px-3 py-2 text-sm leading-6 text-text-main outline-none focus:border-primary"
        />
      </section>

      <section className="mt-4 border-t border-border pt-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[10px] font-semibold tracking-[0.16em] text-slate-500">
              关联 trick
            </div>
            <div className="mt-1 text-xs text-text-secondary">
              {(() => {
                const alive = paper.generatedTrickIds.filter((id) => cardMap.has(id)).length;
                return alive ? `已生成 ${alive} 张卡片` : "还没有从这篇论文生成卡片。";
              })()}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setLinkOpen(!linkOpen)}
              className="flex h-9 items-center gap-1.5 rounded-xl border border-border bg-white px-3 text-xs font-medium text-slate-600 hover:border-primary hover:text-primary"
            >
              <Link2 className="h-3.5 w-3.5" />
              手动关联
            </button>
            {/* 暂时关闭 LLM 生成 Trick
            <button
              type="button"
              onClick={onGenerate}
              className="flex h-9 items-center gap-1.5 rounded-xl bg-primary px-3 text-xs font-medium text-white"
            >
              <Sparkles className="h-3.5 w-3.5" />
              生成 Trick 卡片
            </button>
            */}
          </div>
        </div>

        {linkOpen ? (
          <div className="mt-3 rounded-xl border border-border bg-white p-3">
            <input
              type="text"
              value={linkSearch}
              onChange={(e) => setLinkSearch(e.target.value)}
              placeholder="搜索已有卡片名称…"
              className="h-8 w-full rounded-lg border border-border bg-slate-50 px-3 text-xs outline-none placeholder:text-slate-400 focus:border-primary"
            />
            <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto scrollbar-thin">
              {Array.from(cardMap.values())
                .filter(
                  (card) =>
                    !paper.generatedTrickIds.includes(card.id) &&
                    (!linkSearch ||
                      card.title.toLowerCase().includes(linkSearch.toLowerCase()))
                )
                .slice(0, 20)
                .map((card) => (
                  <li key={card.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onLinkTrick(card.id);
                        setLinkOpen(false);
                        setLinkSearch("");
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-slate-700 hover:bg-primary-soft hover:text-primary"
                    >
                      <FileText className="h-3 w-3 shrink-0" />
                      <span className="truncate">{card.title}</span>
                    </button>
                  </li>
                ))}
              {Array.from(cardMap.values()).filter(
                (card) =>
                  !paper.generatedTrickIds.includes(card.id) &&
                  (!linkSearch ||
                    card.title.toLowerCase().includes(linkSearch.toLowerCase()))
              ).length === 0 ? (
                <li className="px-2 py-2 text-xs text-slate-400">
                  {linkSearch ? "没有匹配的卡片" : "暂无可关联的卡片"}
                </li>
              ) : null}
            </ul>
          </div>
        ) : null}

        {paper.generatedTrickIds.length ? (
          <ul className="mt-3 flex flex-wrap gap-2">
            {paper.generatedTrickIds.map((id) => {
              const card = cardMap.get(id);
              if (!card) return null;
              return (
                <li key={id}>
                  <span className="group flex items-center gap-1 rounded-full border border-border bg-white pl-2.5 pr-1 py-1">
                    <button
                      type="button"
                      onClick={() => onJumpCard(id)}
                      className="flex items-center gap-1.5 text-[11px] font-medium text-slate-700 hover:text-primary"
                    >
                      <FileText className="h-3 w-3" />
                      {card.title}
                    </button>
                    <button
                      type="button"
                      onClick={() => onUnlinkTrick(id)}
                      title="取消关联"
                      className="flex h-4 w-4 items-center justify-center rounded-full text-slate-400 hover:bg-rose-100 hover:text-rose-600"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
        ) : null}
      </section>
    </article>
  );
}

function EmptyListState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-slate-50 p-10 text-center">
      <BookOpen className="h-8 w-8 text-slate-400" />
      <div className="text-sm font-medium text-text-main">没有匹配的论文</div>
      <p className="text-xs leading-5 text-text-secondary">
        清空筛选条件，或者直接添加一篇新论文开始管理。
      </p>
      <button
        type="button"
        onClick={onCreate}
        className="flex h-9 items-center gap-1.5 rounded-full bg-primary px-3 text-xs font-medium text-white"
      >
        <Plus className="h-3.5 w-3.5" />
        新增论文
      </button>
    </div>
  );
}

function EmptyDetailState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-white p-10 text-center shadow-soft">
      <BookOpen className="h-8 w-8 text-slate-400" />
      <div className="text-sm font-medium text-text-main">还没选中任何论文</div>
      <p className="text-xs leading-5 text-text-secondary">
        从左侧选择一篇查看详情，或者新增第一篇论文。
      </p>
      <button
        type="button"
        onClick={onCreate}
        className="flex h-9 items-center gap-1.5 rounded-full border border-border bg-white px-3 text-xs font-medium text-slate-600"
      >
        <Plus className="h-3.5 w-3.5" />
        新增论文
      </button>
    </div>
  );
}

type PaperDraft = {
  title: string;
  authors: string;
  venue: string;
  year: string;
  abstract: string;
  url: string;
  tags: string;
  status: PaperStatus;
  collectionId: string;
  notes: string;
};

function paperToDraft(paper: Paper | null): PaperDraft {
  return {
    title: paper?.title ?? "",
    authors: paper?.authors.join("、") ?? "",
    venue: paper?.venue ?? "",
    year: paper?.year ? String(paper.year) : "",
    abstract: paper?.abstract ?? "",
    url: paper?.url ?? "",
    tags: paper?.tags.join(", ") ?? "",
    status: paper?.status ?? "todo",
    collectionId: paper?.collectionId ?? "",
    notes: paper?.notes ?? ""
  };
}

function PaperEditor({
  paper,
  collections,
  onClose,
  onSubmit
}: {
  paper: Paper | null;
  collections: Collection[];
  onClose: () => void;
  onSubmit: (paper: Paper) => void;
}) {
  const isEditing = Boolean(paper);
  const [draft, setDraft] = useState<PaperDraft>(() => paperToDraft(paper));
  const [importInput, setImportInput] = useState("");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importToast, setImportToast] = useState<string | null>(null);

  useEffect(() => {
    setDraft(paperToDraft(paper));
    setImportInput("");
    setImportError(null);
    setImportToast(null);
  }, [paper]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (!importToast) return;
    const handle = window.setTimeout(() => setImportToast(null), 2400);
    return () => window.clearTimeout(handle);
  }, [importToast]);

  function update<K extends keyof PaperDraft>(key: K, value: PaperDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function handleImport() {
    const input = importInput.trim();
    if (!input) {
      setImportError("请粘贴论文链接、DOI 或关键词");
      return;
    }
    setImporting(true);
    setImportError(null);
    try {
      const p = await callImportPaper(input);
      const summary = p.summary?.trim() ?? "";
      const highlights = (p.highlights ?? []).filter(Boolean);
      const notesLines: string[] = [];
      if (highlights.length) {
        notesLines.push("【AI 摘要要点】");
        highlights.forEach((h) => notesLines.push(`- ${h}`));
      }
      setDraft((current) => ({
        ...current,
        title: current.title.trim() ? current.title : p.title,
        authors: current.authors.trim()
          ? current.authors
          : p.authors.join("、"),
        venue: current.venue.trim() ? current.venue : p.venue ?? "",
        year: current.year.trim() ? current.year : p.year ? String(p.year) : "",
        url: current.url.trim() ? current.url : p.url,
        abstract: current.abstract.trim()
          ? current.abstract
          : summary || p.abstract,
        tags: current.tags.trim()
          ? current.tags
          : (p.tags ?? []).join(", "),
        notes: current.notes.trim()
          ? current.notes
          : notesLines.join("\n")
      }));
      setImportToast(
        summary ? "已导入并由 AI 生成中文摘要" : "已导入论文元数据"
      );
    } catch (err) {
      setImportError((err as Error).message);
    } finally {
      setImporting(false);
    }
  }

  function handleSubmit() {
    if (!draft.title.trim()) {
      window.alert("请填写论文标题");
      return;
    }

    const now = new Date().toISOString();
    const id = paper?.id ?? generateId("paper");
    const yearNumber = draft.year.trim() ? Number(draft.year) : undefined;

    const next: Paper = {
      id,
      title: draft.title.trim(),
      authors: draft.authors
        .split(/[、,，]/)
        .map((value) => value.trim())
        .filter(Boolean),
      venue: draft.venue.trim() || undefined,
      year:
        typeof yearNumber === "number" && Number.isFinite(yearNumber)
          ? yearNumber
          : undefined,
      abstract: draft.abstract.trim() || undefined,
      url: draft.url.trim() || undefined,
      pdfUrl: paper?.pdfUrl,
      tags: draft.tags
        .split(/[，,]/)
        .map((value) => value.trim())
        .filter(Boolean),
      status: draft.status,
      rating: paper?.rating,
      notes: draft.notes,
      generatedTrickIds: paper?.generatedTrickIds ?? [],
      collectionId: draft.collectionId || undefined,
      addedAt: paper?.addedAt ?? now,
      updatedAt: now
    };

    onSubmit(next);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-6 animate-modal-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-surface shadow-panel animate-modal-panel">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div>
            <div className="text-[10px] font-semibold tracking-[0.18em] text-slate-500">
              {isEditing ? "编辑论文" : "新增论文"}
            </div>
            <h2 className="mt-1 text-base font-semibold text-text-main">
              {isEditing ? "编辑论文信息" : "记录一篇新的论文"}
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
          <section className="rounded-2xl border border-dashed border-primary/40 bg-primary-soft/40 p-3">
            <div className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.16em] text-primary">
              <Download className="h-3.5 w-3.5" />
              智能导入论文
            </div>
            <p className="mt-1 text-[11px] leading-5 text-slate-600">
              粘贴任意论文链接、DOI（如 10.xxxx/…）、或直接输入标题关键词即可导入。支持所有来源（arXiv、ACL、CVPR、IEEE、Springer、Nature 等）。配置 LLM 后可自动生成中文摘要。
            </p>
            <div className="mt-2 grid gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
              <input
                value={importInput}
                onChange={(event) => setImportInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !importing) {
                    event.preventDefault();
                    handleImport();
                  }
                }}
                placeholder="论文链接 / DOI / 标题关键词（支持所有来源）"
                className={inputClass}
                disabled={importing}
              />
              <button
                type="button"
                onClick={handleImport}
                disabled={importing || !importInput.trim()}
                className="flex h-10 items-center justify-center gap-1.5 rounded-xl bg-primary px-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {importing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {importing ? "导入中…" : "导入"}
              </button>
            </div>
            {importError ? (
              <div className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] text-rose-700">
                {importError}
              </div>
            ) : null}
            {importToast ? (
              <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] text-emerald-700">
                {importToast}
              </div>
            ) : null}
          </section>

          <Field label="标题">
            <input
              autoFocus
              value={draft.title}
              onChange={(event) => update("title", event.target.value)}
              placeholder="论文标题"
              className={inputClass}
            />
          </Field>

          <div className="grid gap-3 md:grid-cols-2">
            <Field label="作者（用 / , / 、 分隔）">
              <input
                value={draft.authors}
                onChange={(event) => update("authors", event.target.value)}
                placeholder="例如：Wei Lin、Anna Park"
                className={inputClass}
              />
            </Field>
            <Field label="出处 / 会议 / 期刊">
              <input
                value={draft.venue}
                onChange={(event) => update("venue", event.target.value)}
                placeholder="例如：ACL / arXiv / 工程博客"
                className={inputClass}
              />
            </Field>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <Field label="年份">
              <input
                value={draft.year}
                onChange={(event) => update("year", event.target.value)}
                placeholder="2025"
                className={inputClass}
              />
            </Field>
            <Field label="阅读状态">
              <select
                value={draft.status}
                onChange={(event) =>
                  update("status", event.target.value as PaperStatus)
                }
                className={inputClass}
              >
                {statusOrder.map((status) => (
                  <option key={status} value={status}>
                    {statusMeta[status].label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="关联专栏">
              <select
                value={draft.collectionId}
                onChange={(event) =>
                  update("collectionId", event.target.value)
                }
                className={inputClass}
              >
                <option value="">暂不关联</option>
                {collections.map((collection) => (
                  <option key={collection.id} value={collection.id}>
                    {collection.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="摘要 / 一句话总结">
            <textarea
              value={draft.abstract}
              onChange={(event) => update("abstract", event.target.value)}
              placeholder="用 1-3 句话写出这篇论文最值得记住的内容"
              className={cn(inputClass, "min-h-[96px] resize-none")}
            />
          </Field>

          <div className="grid gap-3 md:grid-cols-2">
            <Field label="链接">
              <input
                value={draft.url}
                onChange={(event) => update("url", event.target.value)}
                placeholder="https://"
                className={inputClass}
              />
            </Field>
            <Field label="标签（用 , 或 ，分隔）">
              <input
                value={draft.tags}
                onChange={(event) => update("tags", event.target.value)}
                placeholder="RAG, Multimodal"
                className={inputClass}
              />
            </Field>
          </div>

          <Field label="阅读笔记（可后续在详情面板继续编辑）">
            <textarea
              value={draft.notes}
              onChange={(event) => update("notes", event.target.value)}
              placeholder="记录这篇论文里值得抄进 trick card 的细节"
              className={cn(inputClass, "min-h-[96px] resize-none")}
            />
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
            {isEditing ? "保存修改" : "添加论文"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-1 text-[10px] font-semibold tracking-[0.16em] text-slate-500">
        {label}
      </div>
      {children}
    </label>
  );
}
