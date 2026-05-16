"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  ClipboardCopy,
  GitCompareArrows,
  Plus,
  Trash2,
  X
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AsyncImage } from "@/components/AsyncImage";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { TopBar } from "@/components/layout/TopBar";
import {
  COMPARE_CARD_LIMIT,
  useTrickStore
} from "@/lib/store/TrickStore";
import { Collection, TrickCard } from "@/lib/types";
import {
  cn,
  getCardCover,
  getCollectionMap,
  getSourceTypeLabel,
  statusMeta
} from "@/lib/utils";

type CompareRow = {
  key: string;
  label: string;
  render: (card: TrickCard, collection?: Collection) => React.ReactNode;
  toMarkdown: (card: TrickCard, collection?: Collection) => string;
};

const compareRows: CompareRow[] = [
  {
    key: "collection",
    label: "专栏",
    render: (_card, collection) =>
      collection ? (
        <span
          className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium"
          style={{
            backgroundColor: `${collection.color}18`,
            color: collection.color
          }}
        >
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: collection.color }}
          />
          {collection.name}
        </span>
      ) : (
        <span className="text-slate-400">未归属</span>
      ),
    toMarkdown: (_card, collection) => collection?.name ?? "—"
  },
  {
    key: "status",
    label: "状态",
    render: (card) => {
      const status = statusMeta[card.status];
      return (
        <span
          className={cn(
            "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium",
            status.tone
          )}
        >
          <span className={cn("h-2 w-2 rounded-full", status.dot)} />
          {status.label}
        </span>
      );
    },
    toMarkdown: (card) => statusMeta[card.status].label
  },
  {
    key: "tags",
    label: "标签",
    render: (card) =>
      card.tags.length ? (
        <div className="flex flex-wrap gap-1.5">
          {card.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600"
            >
              {tag}
            </span>
          ))}
        </div>
      ) : (
        <span className="text-slate-400">—</span>
      ),
    toMarkdown: (card) => card.tags.join(" / ") || "—"
  },
  {
    key: "problem",
    label: "问题",
    render: (card) => (
      <p className="text-sm leading-6 text-slate-700">{card.problem}</p>
    ),
    toMarkdown: (card) => card.problem
  },
  {
    key: "solution",
    label: "解决方案",
    render: (card) => (
      <p className="text-sm leading-6 text-slate-700">{card.solution}</p>
    ),
    toMarkdown: (card) => card.solution
  },
  {
    key: "benefits",
    label: "收益",
    render: (card) => <BulletList items={card.benefits} />,
    toMarkdown: (card) => listToMarkdown(card.benefits)
  },
  {
    key: "costs",
    label: "代价",
    render: (card) => <BulletList items={card.costs} />,
    toMarkdown: (card) => listToMarkdown(card.costs)
  },
  {
    key: "tradeoffs",
    label: "权衡取舍",
    render: (card) => <BulletList items={card.tradeoffs} />,
    toMarkdown: (card) => listToMarkdown(card.tradeoffs)
  },
  {
    key: "applicable",
    label: "适用场景",
    render: (card) => <ChipList items={card.applicableScenarios} />,
    toMarkdown: (card) => listToMarkdown(card.applicableScenarios)
  },
  {
    key: "unsuitable",
    label: "不适用场景",
    render: (card) => <ChipList items={card.unsuitableScenarios ?? []} muted />,
    toMarkdown: (card) => listToMarkdown(card.unsuitableScenarios ?? [])
  },
  {
    key: "sources",
    label: "来源",
    render: (card) =>
      card.sources.length ? (
        <ul className="space-y-2 text-sm leading-6 text-slate-700">
          {card.sources.map((source) => (
            <li key={source.id}>
              <span className="font-medium text-text-main">
                {source.title}
              </span>
              <span className="ml-1 text-slate-500">
                · {getSourceTypeLabel(source.type)}
                {source.year ? ` · ${source.year}` : ""}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <span className="text-slate-400">—</span>
      ),
    toMarkdown: (card) =>
      card.sources.length
        ? card.sources
            .map(
              (source) =>
                `${source.title} (${getSourceTypeLabel(source.type)}${
                  source.year ? `, ${source.year}` : ""
                })`
            )
            .join("; ")
        : "—"
  },
  {
    key: "usages",
    label: "使用记录",
    render: (card) =>
      card.usages.length ? (
        <ul className="space-y-2 text-sm leading-6 text-slate-700">
          {card.usages.map((usage) => (
            <li key={usage.id}>
              <span className="font-medium text-text-main">
                {usage.projectName ?? "未命名项目"}
              </span>
              {usage.scenario ? (
                <span className="ml-1 text-slate-500">
                  · {usage.scenario}
                </span>
              ) : null}
              <div className="text-slate-600">{usage.result}</div>
            </li>
          ))}
        </ul>
      ) : (
        <span className="text-slate-400">还没有复现效果</span>
      ),
    toMarkdown: (card) =>
      card.usages.length
        ? card.usages
            .map(
              (usage) =>
                `${usage.projectName ?? "项目"}: ${usage.result || "—"}`
            )
            .join("; ")
        : "—"
  }
];

export function CompareWorkspace() {
  const router = useRouter();
  const {
    cards,
    collections,
    compareIds,
    toggleCompare,
    removeFromCompare,
    clearCompare
  } = useTrickStore();

  const [pickerOpen, setPickerOpen] = useState(false);
  const [exportFeedback, setExportFeedback] = useState<string | null>(null);

  const collectionMap = useMemo(
    () => getCollectionMap(collections),
    [collections]
  );

  const compareCards = useMemo(() => {
    return compareIds
      .map((id) => cards.find((card) => card.id === id))
      .filter((card): card is TrickCard => Boolean(card));
  }, [compareIds, cards]);

  const candidateCards = useMemo(() => {
    return cards.filter((card) => !compareIds.includes(card.id));
  }, [cards, compareIds]);

  function buildMarkdown() {
    if (!compareCards.length) {
      return "";
    }

    const headers = ["维度", ...compareCards.map((card) => card.title)];
    const separator = headers.map(() => "---");
    const rows = compareRows.map((row) => {
      const cells = compareCards.map((card) =>
        row
          .toMarkdown(card, collectionMap.get(card.collectionId))
          .replace(/\|/g, "\\|")
          .replace(/\n+/g, "<br />")
      );

      return [row.label, ...cells];
    });

    return [headers, separator, ...rows]
      .map((columns) => `| ${columns.join(" | ")} |`)
      .join("\n");
  }

  async function handleExport() {
    const markdown = buildMarkdown();

    if (!markdown) {
      return;
    }

    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(markdown);
        setExportFeedback("已复制 Markdown 对比表到剪贴板");
        window.setTimeout(() => setExportFeedback(null), 2400);
        return;
      } catch {
        // fall through to alert
      }
    }

    window.prompt("复制以下 Markdown 对比表：", markdown);
  }

  return (
    <DashboardLayout>
      <TopBar
        title="横向对比"
        subtitle="同时比较多张 trick 的问题、收益、代价与取舍。"
        eyebrow=""
        primaryAction={{
          label: "添加卡片",
          icon: Plus,
          onClick: () => setPickerOpen(true),
          disabled: compareIds.length >= COMPARE_CARD_LIMIT
        }}
        secondaryAction={{
          label: compareIds.length ? "清空对比" : "去选卡片",
          icon: compareIds.length ? Trash2 : ArrowRight,
          onClick: () =>
            compareIds.length ? clearCompare() : router.push("/cards")
        }}
      />

      <div className="space-y-6 px-5 py-6 xl:px-8">
        <section className="rounded-3xl border border-border/80 bg-surface p-5 shadow-soft">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-medium text-text-main">
                已选 {compareCards.length} / {COMPARE_CARD_LIMIT} 张 trick
              </div>
              <div className="mt-1 text-sm text-text-secondary">
                {compareCards.length
                  ? "横向对比下方表格，可一键复制 Markdown。"
                  : "去卡片墙选两张及以上 trick，再回到这里横向对比。"}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleExport}
                disabled={!compareCards.length}
                className="flex h-10 items-center gap-2 rounded-xl border border-border bg-white px-4 text-sm font-medium text-text-main shadow-soft disabled:cursor-not-allowed disabled:opacity-45"
              >
                <ClipboardCopy className="h-4 w-4" />
                复制 Markdown
              </button>
              {exportFeedback ? (
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                  {exportFeedback}
                </span>
              ) : null}
            </div>
          </div>
        </section>

        {compareCards.length ? (
          <CompareTable
            cards={compareCards}
            collectionMap={collectionMap}
            onRemove={removeFromCompare}
          />
        ) : (
          <EmptyState onPick={() => setPickerOpen(true)} />
        )}
      </div>

      {pickerOpen ? (
        <CardPicker
          cards={candidateCards}
          collectionMap={collectionMap}
          onClose={() => setPickerOpen(false)}
          onSelect={(card) => {
            toggleCompare(card.id);
          }}
          remainingSlots={COMPARE_CARD_LIMIT - compareIds.length}
        />
      ) : null}
    </DashboardLayout>
  );
}

type CompareTableProps = {
  cards: TrickCard[];
  collectionMap: Map<string, Collection>;
  onRemove: (cardId: string) => void;
};

function CompareTable({ cards, collectionMap, onRemove }: CompareTableProps) {
  return (
    <section className="sticky top-0 overflow-hidden rounded-3xl border border-border/80 bg-surface shadow-soft">
      <div className="overflow-auto overscroll-contain scrollbar-thin" style={{ maxHeight: "calc(100vh - 14rem)" }}>
        <table className="min-w-full border-collapse text-left align-top">
          <thead>
            <tr className="sticky top-0 z-20 border-b border-border bg-slate-50">
              <th
                className="sticky left-0 z-30 w-44 min-w-[160px] border-r border-border bg-slate-50 p-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500"
                scope="col"
              >
                维度
              </th>
              {cards.map((card) => {
                const collection = collectionMap.get(card.collectionId);
                return (
                  <th
                    key={card.id}
                    scope="col"
                    className="sticky top-0 z-20 min-w-[280px] border-r border-border bg-slate-50 p-4 align-top"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        {collection ? (
                          <span
                            className="inline-flex items-center gap-2 rounded-full px-2.5 py-0.5 text-xs font-medium"
                            style={{
                              backgroundColor: `${collection.color}18`,
                              color: collection.color
                            }}
                          >
                            <span
                              className="h-2 w-2 rounded-full"
                              style={{ backgroundColor: collection.color }}
                            />
                            {collection.name}
                          </span>
                        ) : null}
                        {(() => {
                          const cover = getCardCover(card);
                          return cover ? (
                            <div className="mt-2 overflow-hidden rounded-lg border border-border bg-slate-50">
                              <div className="aspect-[16/9] w-full">
                                <AsyncImage
                                  src={cover.url}
                                  alt={cover.title ?? card.title}
                                  className="h-full w-full object-cover"
                                />
                              </div>
                            </div>
                          ) : null;
                        })()}
                        <div className="mt-2 text-base font-semibold text-text-main">
                          {card.title}
                        </div>
                        {card.subtitle ? (
                          <div className="mt-1 text-xs text-slate-500">
                            {card.subtitle}
                          </div>
                        ) : null}
                      </div>

                      <button
                        type="button"
                        onClick={() => onRemove(card.id)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-white text-slate-500"
                        aria-label="移出对比"
                        title="移出对比"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {compareRows.map((row, index) => (
              <tr
                key={row.key}
                className={cn(
                  "border-b border-border align-top",
                  index % 2 === 1 ? "bg-slate-50/40" : "bg-white"
                )}
              >
                <th
                  scope="row"
                  className="sticky left-0 z-10 w-44 min-w-[160px] border-r border-border bg-inherit p-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500"
                >
                  {row.label}
                </th>
                {cards.map((card) => (
                  <td
                    key={card.id}
                    className="min-w-[280px] border-r border-border p-4 align-top"
                  >
                    {row.render(card, collectionMap.get(card.collectionId))}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function EmptyState({ onPick }: { onPick: () => void }) {
  return (
    <section className="flex flex-col items-center justify-center gap-4 rounded-3xl border border-dashed border-border bg-white p-16 text-center shadow-soft">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-soft text-primary">
        <GitCompareArrows className="h-7 w-7" />
      </div>
      <div>
        <div className="text-lg font-semibold text-text-main">
          还没有加入对比的 trick
        </div>
        <p className="mt-2 text-sm leading-6 text-text-secondary">
          回到卡片墙，点击卡片右上角「加入对比」即可在这里横向比较，最多 {COMPARE_CARD_LIMIT} 张。
        </p>
      </div>
      <div className="flex items-center gap-3">
        <Link
          href="/cards"
          className="flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-white shadow-soft"
        >
          去卡片墙挑选
          <ArrowRight className="h-4 w-4" />
        </Link>
        <button
          type="button"
          onClick={onPick}
          className="flex h-10 items-center gap-2 rounded-xl border border-border bg-white px-4 text-sm font-medium text-slate-600"
        >
          <Plus className="h-4 w-4" />
          这里直接添加
        </button>
      </div>
    </section>
  );
}

type CardPickerProps = {
  cards: TrickCard[];
  collectionMap: Map<string, Collection>;
  remainingSlots: number;
  onClose: () => void;
  onSelect: (card: TrickCard) => void;
};

function CardPicker({
  cards,
  collectionMap,
  remainingSlots,
  onClose,
  onSelect
}: CardPickerProps) {
  const [query, setQuery] = useState("");

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

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return cards;
    }

    return cards.filter((card) => {
      const collection = collectionMap.get(card.collectionId);
      const haystack = [
        card.title,
        card.subtitle,
        card.description,
        collection?.name,
        ...card.tags
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalized);
    });
  }, [cards, collectionMap, query]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-6 animate-modal-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-surface shadow-panel animate-modal-panel">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <div className="text-xs font-semibold tracking-[0.18em] text-slate-500">
              选择对比卡片
            </div>
            <h2 className="mt-1 text-xl font-semibold text-text-main">
              添加到对比
            </h2>
            <p className="mt-1 text-xs text-text-secondary">
              还可以再加 {Math.max(0, remainingSlots)} 张
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-border text-slate-500"
            aria-label="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="border-b border-border px-6 py-3">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索 trick 标题、标签或专栏"
            className="h-11 w-full rounded-xl border border-border bg-white px-3 text-sm outline-none focus:border-primary"
          />
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {filtered.length ? (
            <ul className="space-y-2">
              {filtered.map((card) => {
                const collection = collectionMap.get(card.collectionId);

                return (
                  <li key={card.id}>
                    <button
                      type="button"
                      onClick={() => onSelect(card)}
                      disabled={remainingSlots <= 0}
                      className="flex w-full items-start gap-3 rounded-2xl border border-border bg-white p-4 text-left transition hover:border-primary/40 hover:bg-primary-soft/40 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          {collection ? (
                            <span
                              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
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
                          <span className="text-sm font-semibold text-text-main">
                            {card.title}
                          </span>
                        </div>
                        <p className="mt-1 line-clamp-2 text-xs text-text-secondary">
                          {card.description}
                        </p>
                      </div>
                      <Plus className="h-4 w-4 shrink-0 text-primary" />
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="rounded-2xl border border-dashed border-border bg-slate-50 p-8 text-center text-sm text-slate-500">
              没有匹配的卡片。
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function BulletList({ items }: { items: string[] }) {
  if (!items.length) {
    return <span className="text-slate-400">—</span>;
  }

  return (
    <ul className="space-y-1.5 text-sm leading-6 text-slate-700">
      {items.map((item) => (
        <li key={item}>• {item}</li>
      ))}
    </ul>
  );
}

function ChipList({ items, muted = false }: { items: string[]; muted?: boolean }) {
  if (!items.length) {
    return <span className="text-slate-400">—</span>;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <span
          key={item}
          className={cn(
            "rounded-full px-2.5 py-0.5 text-xs font-medium",
            muted
              ? "bg-rose-50 text-rose-600"
              : "bg-primary-soft text-primary"
          )}
        >
          {item}
        </span>
      ))}
    </div>
  );
}

function listToMarkdown(items: string[]) {
  if (!items.length) {
    return "—";
  }

  return items.map((item) => `• ${item}`).join("<br />");
}
