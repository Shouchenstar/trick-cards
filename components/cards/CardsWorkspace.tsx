"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CircleDot,
  ClipboardList,
  Copy,
  GitCompareArrows,
  PanelRightClose,
  PanelRightOpen,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Tag,
  Trash2
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { CardDetailPanel } from "@/components/cards/CardDetailPanel";
import { CardEditorModal } from "@/components/cards/CardEditorModal";
import { CardReaderModal } from "@/components/cards/CardReaderModal";
import { CardTile } from "@/components/cards/CardTile";
import { CollectionTabs } from "@/components/collections/CollectionTabs";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ContextMenu, type MenuItem } from "@/components/ui/ContextMenu";
import { useTrickStore } from "@/lib/store/TrickStore";
import { CardStatus, Collection, TrickCard } from "@/lib/types";
import { cn, getCollectionMap, statusMeta } from "@/lib/utils";

type StatusFilter = CardStatus | "all";

export function CardsWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    cards,
    collections,
    storageReady,
    saveCard,
    deleteCard,
    createCollection,
    deleteCollection,
    compareIds,
    toggleCompare,
    isInCompare
  } = useTrickStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [activeCollectionId, setActiveCollectionId] = useState(() => {
    const fromUrl = searchParams?.get("collection");
    return fromUrl || "all";
  });
  const [activeTag, setActiveTag] = useState("all");
  const [activeStatus, setActiveStatus] = useState<StatusFilter>("all");
  const [selectedCardId, setSelectedCardId] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [readerOpen, setReaderOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<TrickCard | null>(null);
  const [detailCollapsed, setDetailCollapsed] = useState(false);

  const [ctxMenu, setCtxMenu] = useState<{
    x: number;
    y: number;
    items: MenuItem[];
  } | null>(null);

  // 折叠状态持久化（用户在卡片墙看到的状态在刷新后保留）
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(
      "trick-cards.cards.detail-collapsed"
    );
    if (saved === "1") setDetailCollapsed(true);
  }, []);
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      "trick-cards.cards.detail-collapsed",
      detailCollapsed ? "1" : "0"
    );
  }, [detailCollapsed]);

  const collectionMap = useMemo(
    () => getCollectionMap(collections),
    [collections]
  );

  useEffect(() => {
    if (storageReady && !selectedCardId && cards.length) {
      setSelectedCardId(cards[0].id);
    }
  }, [storageReady, selectedCardId, cards]);

  const collectionCounts = useMemo(() => {
    return cards.reduce<Record<string, number>>((accumulator, card) => {
      accumulator[card.collectionId] = (accumulator[card.collectionId] ?? 0) + 1;
      return accumulator;
    }, {});
  }, [cards]);

  const availableTags = useMemo(() => {
    return Array.from(new Set(cards.flatMap((card) => card.tags))).sort((a, b) =>
      a.localeCompare(b)
    );
  }, [cards]);

  const filteredCards = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return cards
      .filter((card) => {
        const matchesCollection =
          activeCollectionId === "all" ||
          card.collectionId === activeCollectionId;
        const matchesTag = activeTag === "all" || card.tags.includes(activeTag);
        const matchesStatus =
          activeStatus === "all" || card.status === activeStatus;

        if (!matchesCollection || !matchesTag || !matchesStatus) {
          return false;
        }

        if (!normalizedQuery) {
          return true;
        }

        const collection = collectionMap.get(card.collectionId);
        const haystack = [
          card.title,
          card.subtitle,
          card.description,
          card.problem,
          card.solution,
          collection?.name,
          ...card.tags
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return haystack.includes(normalizedQuery);
      })
      .sort(
        (left, right) =>
          new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
      );
  }, [
    activeCollectionId,
    activeStatus,
    activeTag,
    cards,
    collectionMap,
    searchQuery
  ]);

  useEffect(() => {
    if (!filteredCards.length) {
      setSelectedCardId("");
      return;
    }

    if (!filteredCards.some((card) => card.id === selectedCardId)) {
      setSelectedCardId(filteredCards[0].id);
    }
  }, [filteredCards, selectedCardId]);

  const selectedCard =
    filteredCards.find((card) => card.id === selectedCardId) ??
    cards.find((card) => card.id === selectedCardId) ??
    null;

  const relatedCards = useMemo(() => {
    if (!selectedCard) {
      return [];
    }

    return cards.filter((card) => selectedCard.relatedCardIds.includes(card.id));
  }, [cards, selectedCard]);

  function openCreateEditor() {
    setEditingCard(null);
    setEditorOpen(true);
  }

  function openEditEditor(card: TrickCard) {
    setEditingCard(card);
    setEditorOpen(true);
  }

  function openReader(card: TrickCard) {
    setSelectedCardId(card.id);
    setReaderOpen(true);
  }

  function handleSaveCard(nextCard: TrickCard) {
    saveCard(nextCard);

    setSearchQuery("");
    setActiveCollectionId(nextCard.collectionId);
    setActiveTag("all");
    setActiveStatus("all");
    setSelectedCardId(nextCard.id);
    setEditorOpen(false);
    setEditingCard(null);
  }

  function handleDeleteCard(cardToDelete: TrickCard) {
    const confirmed = window.confirm(`删除「${cardToDelete.title}」？`);

    if (!confirmed) {
      return;
    }

    deleteCard(cardToDelete.id);

    if (selectedCardId === cardToDelete.id) {
      setSelectedCardId("");
    }
  }

  function clearSecondaryFilters() {
    setActiveTag("all");
    setActiveStatus("all");
  }

  const hasSecondaryFilters = activeTag !== "all" || activeStatus !== "all";

  if (!storageReady) {
    return (
      <DashboardLayout>
        <div className="space-y-4 px-4 py-4 xl:px-6">
          <div className="flex flex-wrap items-center gap-4 rounded-xl border border-border/60 bg-surface px-4 py-2 shadow-sm">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="h-6 w-6 animate-pulse rounded-md bg-slate-100" />
                <span className="h-4 w-12 animate-pulse rounded bg-slate-100" />
                <span className="h-4 w-6 animate-pulse rounded bg-slate-100" />
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-border/60 bg-surface p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="h-5 w-16 animate-pulse rounded bg-slate-100" />
              <span className="ml-auto h-7 w-48 animate-pulse rounded-lg bg-slate-100" />
              <span className="h-7 w-16 animate-pulse rounded-lg bg-slate-100" />
              <span className="h-7 w-16 animate-pulse rounded-lg bg-slate-100" />
            </div>
            <div className="mt-3 flex gap-3">
              {[1, 2, 3, 4].map((i) => (
                <span key={i} className="h-10 w-32 animate-pulse rounded-xl bg-slate-100" />
              ))}
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div key={i} className="rounded-xl border border-border/60 bg-white shadow-sm">
                  <div className="aspect-[4/3] animate-pulse rounded-t-xl bg-slate-100" />
                  <div className="space-y-2 p-3">
                    <div className="h-4 w-3/4 animate-pulse rounded bg-slate-100" />
                    <div className="h-3 w-1/2 animate-pulse rounded bg-slate-100" />
                    <div className="h-3 w-full animate-pulse rounded bg-slate-100" />
                    <div className="h-5 w-16 animate-pulse rounded-full bg-slate-100" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-4 px-4 py-4 xl:px-6">
        <section
          className={cn(
            "grid gap-4",
            detailCollapsed
              ? "xl:grid-cols-1"
              : "xl:grid-cols-[minmax(0,2fr)_300px]"
          )}
        >
          <div className="rounded-xl border border-border/60 bg-surface p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold text-text-main">
                卡片墙
              </h2>
              <span className="text-xs text-slate-400">
                {filteredCards.length} 张
              </span>

              <label className="ml-auto flex h-7 w-48 items-center gap-1.5 rounded-lg border border-border bg-white px-2">
                <Search className="h-3 w-3 shrink-0 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="搜索卡片…"
                  className="h-full w-full bg-transparent text-xs text-text-main outline-none placeholder:text-slate-400"
                />
              </label>

              <button
                type="button"
                onClick={() => router.push("/compare")}
                className="flex h-7 items-center gap-1 rounded-lg border border-border bg-white px-2 text-xs font-medium text-slate-600 hover:border-slate-400"
              >
                <GitCompareArrows className="h-3 w-3" />
                {compareIds.length ? `对比 ${compareIds.length}` : "对比"}
              </button>

              <button
                type="button"
                onClick={openCreateEditor}
                className="flex h-7 items-center gap-1 rounded-lg bg-primary px-2.5 text-xs font-medium text-white"
              >
                <Plus className="h-3 w-3" />
                新建
              </button>

              <button
                type="button"
                onClick={() => setDetailCollapsed((v) => !v)}
                aria-label={detailCollapsed ? "展开详情面板" : "折叠详情面板"}
                title={detailCollapsed ? "展开详情面板" : "折叠详情面板"}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-white text-slate-500 hover:border-primary hover:text-primary"
              >
                {detailCollapsed ? (
                  <PanelRightOpen className="h-3.5 w-3.5" />
                ) : (
                  <PanelRightClose className="h-3.5 w-3.5" />
                )}
              </button>
            </div>

            <div className="mt-2 flex items-center gap-2 overflow-x-auto">
              <CollectionTabs
                collections={collections}
                activeCollectionId={activeCollectionId}
                counts={collectionCounts}
                onChange={setActiveCollectionId}
                onCreateCollection={() => {
                  const name = window.prompt("输入新专栏名称：");
                  if (name?.trim()) {
                    createCollection(name.trim());
                  }
                }}
                onEditCollection={(collection) => {
                  router.push("/collections");
                }}
                onDeleteCollection={(collection) => {
                  const fallback = collections.find((c) => c.id !== collection.id);
                  if (window.confirm(`删除专栏「${collection.name}」？`)) {
                    deleteCollection(collection.id, { reassignTo: fallback?.id });
                  }
                }}
              />
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <label className="flex items-center gap-1.5 rounded-md border border-border bg-white px-2 py-1">
                <Tag className="h-3 w-3 text-slate-400" />
                <select
                  className="h-5 min-w-0 bg-transparent text-[11px] text-text-main outline-none"
                  value={activeTag}
                  onChange={(event) => setActiveTag(event.target.value)}
                >
                  <option value="all">全部标签</option>
                  {availableTags.map((tag) => (
                    <option key={tag} value={tag}>
                      {tag}
                    </option>
                  ))}
                </select>
              </label>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setActiveStatus("all")}
                  className={cn(
                    "flex h-6 shrink-0 items-center gap-1 rounded-md border px-2 text-[11px] font-medium",
                    activeStatus === "all"
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-border bg-white text-slate-600"
                  )}
                >
                  <CircleDot className="h-2.5 w-2.5" />
                  全部状态
                </button>

                {(Object.entries(statusMeta) as Array<
                  [CardStatus, (typeof statusMeta)[CardStatus]]
                >).map(([status, meta]) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setActiveStatus(status)}
                    className={cn(
                      "flex h-6 shrink-0 items-center gap-1 rounded-md border px-2 text-[11px] font-medium",
                      activeStatus === status
                        ? "border-primary bg-primary text-white"
                        : "border-border bg-white text-slate-600"
                    )}
                  >
                    <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
                    {meta.label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={clearSecondaryFilters}
                disabled={!hasSecondaryFilters}
                className="ml-auto flex h-6 items-center gap-1 rounded-md border border-border bg-white px-2 text-[11px] font-medium text-slate-400 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <RotateCcw className="h-2.5 w-2.5" />
                清除筛选
              </button>
            </div>

            {filteredCards.length ? (
              <div className={cn(
                "mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
                detailCollapsed && "2xl:grid-cols-5"
              )}>
                {filteredCards.map((card) => {
                  const collection = collectionMap.get(card.collectionId);
                  if (!collection) {
                    return null;
                  }

                  return (
                    <CardTile
                      key={card.id}
                      card={card}
                      collection={collection}
                      selected={card.id === selectedCardId}
                      inCompare={isInCompare(card.id)}
                      onClick={() => setSelectedCardId(card.id)}
                      onDoubleClick={() => openReader(card)}
                      onToggleCompare={() => toggleCompare(card.id)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setSelectedCardId(card.id);
                        setCtxMenu({
                          x: e.clientX,
                          y: e.clientY,
                          items: [
                            { label: "编辑", icon: Pencil, onClick: () => openEditEditor(card) },
                            { label: "复制标题", icon: Copy, onClick: () => navigator.clipboard.writeText(card.title) },
                            { label: "复制描述", icon: ClipboardList, onClick: () => navigator.clipboard.writeText(card.description) },
                            { label: "删除", icon: Trash2, onClick: () => handleDeleteCard(card), danger: true, dividerAfter: true }
                          ]
                        });
                      }}
                    />
                  );
                })}
              </div>
            ) : (
              <div className="mt-3 rounded-xl border border-dashed border-border bg-slate-50 p-8 text-center text-xs text-slate-400">
                没有匹配到卡片，调整关键词、标签或状态筛选。
              </div>
            )}
          </div>

          {detailCollapsed ? null : (
            <div className="xl:sticky xl:top-6 xl:max-h-[calc(100vh-2rem)] xl:self-start xl:overflow-y-auto xl:overflow-x-hidden scrollbar-thin">
              <CardDetailPanel
                card={selectedCard}
                collection={
                  selectedCard
                    ? collectionMap.get(selectedCard.collectionId)
                    : undefined
                }
                relatedCards={relatedCards}
                onOpenReader={openReader}
                onEdit={openEditEditor}
                onDelete={handleDeleteCard}
              />
            </div>
          )}
        </section>
      </div>

      <CardEditorModal
        open={editorOpen}
        card={editingCard}
        collections={collections}
        onClose={() => {
          setEditorOpen(false);
          setEditingCard(null);
        }}
        onSave={handleSaveCard}
        onCreateCollection={(name) => createCollection(name)}
      />

      <CardReaderModal
        open={readerOpen}
        card={selectedCard}
        collection={
          selectedCard ? collectionMap.get(selectedCard.collectionId) : undefined
        }
        relatedCards={relatedCards}
        onClose={() => setReaderOpen(false)}
        onEdit={(card) => {
          setReaderOpen(false);
          openEditEditor(card);
        }}
      />

      {ctxMenu ? (
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          items={ctxMenu.items}
          onClose={() => setCtxMenu(null)}
        />
      ) : null}
    </DashboardLayout>
  );
}
