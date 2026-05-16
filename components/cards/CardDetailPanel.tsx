import type { ReactNode } from "react";
import {
  ArrowUpRight,
  Link2,
  Maximize2,
  NotebookPen,
  Pencil,
  Sparkles,
  Trash2
} from "lucide-react";
import { Collection, TrickCard } from "@/lib/types";
import { cn, getCardCover, getSourceTypeLabel, statusMeta } from "@/lib/utils";
import { MarkdownPreview } from "@/components/cards/MarkdownPreview";
import { AsyncImage } from "@/components/AsyncImage";

type CardDetailPanelProps = {
  card: TrickCard | null;
  collection?: Collection;
  relatedCards: TrickCard[];
  onOpenReader?: (card: TrickCard) => void;
  onEdit?: (card: TrickCard) => void;
  onDelete?: (card: TrickCard) => void;
};

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
      {children}
    </h3>
  );
}

export function CardDetailPanel({
  card,
  collection,
  relatedCards,
  onOpenReader,
  onEdit,
  onDelete
}: CardDetailPanelProps) {
  if (!card || !collection) {
    return (
      <aside className="rounded-3xl border border-dashed border-border bg-white/70 p-6 text-sm text-text-secondary shadow-soft">
        选择一张卡片后，这里会展示结构化详情预览。
      </aside>
    );
  }

  const cover = getCardCover(card);
  const status = statusMeta[card.status];

  return (
    <aside className="rounded-3xl border border-border/80 bg-surface shadow-panel">
      <div className="border-b border-border/80 p-6">
        <div className="flex flex-wrap items-center gap-2">
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
          <span
            className={cn(
              "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium",
              status.tone
            )}
          >
            <span className={cn("h-2 w-2 rounded-full", status.dot)} />
            {status.label}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenReader?.(card)}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-white text-slate-600"
              aria-label="放大阅读"
            >
              <Maximize2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => onEdit?.(card)}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-white text-slate-600"
              aria-label="编辑卡片"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => onDelete?.(card)}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-white text-danger"
              aria-label="删除卡片"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        <h2 className="mt-4 text-2xl font-semibold text-text-main">
          {card.title}
        </h2>
        <p className="mt-2 text-sm leading-7 text-text-secondary">
          {card.description}
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {card.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-border bg-white px-3 py-1 text-xs font-medium text-slate-600"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      <div className="space-y-6 p-6">
        {cover ? (
          <div className="overflow-hidden rounded-2xl border border-border bg-slate-50">
            <div className="flex max-h-[60vh] items-center justify-center">
              <AsyncImage
                src={cover.url}
                alt={cover.title ?? card.title}
                className="h-auto max-h-[60vh] w-auto max-w-full object-contain"
              />
            </div>
            {cover.caption ? (
              <div className="border-t border-border bg-white px-4 py-3 text-sm text-slate-500">
                {cover.caption}
              </div>
            ) : null}
          </div>
        ) : null}

        <section>
          <SectionTitle>概览</SectionTitle>
          <div className="mt-3 rounded-2xl bg-slate-50 p-4 text-sm leading-7 text-slate-700">
            <div>
              <span className="font-medium text-text-main">问题：</span>
              {card.problem}
            </div>
            <div className="mt-3">
              <span className="font-medium text-text-main">解决方案：</span>
              {card.solution}
            </div>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <div className="rounded-2xl border border-border p-4">
            <SectionTitle>收益</SectionTitle>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
              {card.benefits.map((item) => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-border p-4">
            <SectionTitle>代价</SectionTitle>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
              {card.costs.map((item) => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
          </div>
        </section>

        <section>
          <SectionTitle>权衡取舍</SectionTitle>
          <div className="mt-3 rounded-2xl border border-border bg-slate-50 p-4 text-sm leading-7 text-slate-700">
            {card.tradeoffs.map((item) => (
              <div key={item} className="flex gap-3">
                <Sparkles className="mt-1 h-4 w-4 shrink-0 text-primary" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </section>

        <section>
          <SectionTitle>心得笔记</SectionTitle>
          <div className="mt-3 space-y-3">
            {card.notes.map((note) => (
              <div
                key={note.id}
                className="rounded-2xl border border-border bg-white p-4 text-sm leading-7 text-slate-700"
              >
                <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-slate-400">
                  <NotebookPen className="h-3.5 w-3.5" />
                  我的笔记
                </div>
                {note.content}
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <div className="rounded-2xl border border-border p-4">
            <SectionTitle>来源</SectionTitle>
            <div className="mt-3 space-y-3">
              {card.sources.map((source) => (
                <div key={source.id} className="text-sm leading-6 text-slate-700">
                  <div className="font-medium text-text-main">{source.title}</div>
                  <div className="text-slate-500">
                    {getSourceTypeLabel(source.type)}
                    {source.year ? ` · ${source.year}` : ""}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-border p-4">
            <SectionTitle>效果</SectionTitle>
            <div className="mt-3 space-y-3">
              {card.usages.length ? (
                card.usages.map((usage) => (
                  <div key={usage.id} className="text-sm text-slate-700">
                    <MarkdownPreview content={usage.result} compact />
                  </div>
                ))
              ) : (
                <div className="text-sm text-slate-500">还没有复现效果。</div>
              )}
            </div>
          </div>
        </section>

        <section>
          <SectionTitle>关联卡片</SectionTitle>
          <div className="mt-3 grid gap-3">
            {relatedCards.length ? (
              relatedCards.map((relatedCard) => (
                <div
                  key={relatedCard.id}
                  className="flex items-center justify-between rounded-2xl border border-border p-4"
                >
                  <div>
                    <div className="font-medium text-text-main">
                      {relatedCard.title}
                    </div>
                    <div className="mt-1 text-sm text-slate-500">
                      {relatedCard.description}
                    </div>
                  </div>
                  <Link2 className="h-4 w-4 text-slate-400" />
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-border p-4 text-sm text-slate-500">
                暂无关联卡片。
              </div>
            )}
          </div>
        </section>

        <section>
          <SectionTitle>适用场景</SectionTitle>
          <div className="mt-3 flex flex-wrap gap-2">
            {card.applicableScenarios.map((scenario) => (
              <span
                key={scenario}
                className="rounded-full border border-border bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600"
              >
                {scenario}
              </span>
            ))}
          </div>
        </section>
      </div>
    </aside>
  );
}
