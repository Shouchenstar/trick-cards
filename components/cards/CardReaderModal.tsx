"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { BookOpen, Link2, Pencil, X } from "lucide-react";
import { Collection, TrickCard } from "@/lib/types";
import { cn, getCardCover, getSourceTypeLabel, statusMeta } from "@/lib/utils";
import { MarkdownPreview } from "@/components/cards/MarkdownPreview";
import { AsyncImage } from "@/components/AsyncImage";

type CardReaderModalProps = {
  open: boolean;
  card: TrickCard | null;
  collection?: Collection;
  relatedCards: TrickCard[];
  onClose: () => void;
  onEdit?: (card: TrickCard) => void;
};

function ReaderSection({
  title,
  children
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="border-t border-border py-8">
      <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
        {title}
      </h3>
      <div className="mt-4 text-base leading-8 text-slate-700">{children}</div>
    </section>
  );
}

function ListBlock({ items }: { items: string[] }) {
  if (!items.length) {
    return <div className="text-slate-500">暂未补充。</div>;
  }

  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item} className="flex gap-3">
          <span className="mt-3 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function CardReaderModal({
  open,
  card,
  collection,
  relatedCards,
  onClose,
  onEdit
}: CardReaderModalProps) {
  const isTextDragging = useRef(false);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open || !card || !collection) {
    return null;
  }

  const cover = getCardCover(card);
  const status = statusMeta[card.status];

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/55 animate-modal-backdrop"
      onMouseDown={() => { isTextDragging.current = false; }}
      onMouseMove={(e) => {
        if (e.buttons === 1) isTextDragging.current = true;
      }}
      onClick={(event) => {
        if (!isTextDragging.current && event.target === event.currentTarget) onClose();
      }}
    >
      <div className="mx-auto flex h-full max-w-6xl flex-col bg-white shadow-panel animate-modal-panel">
        <header className="flex shrink-0 items-center justify-between border-b border-border px-6 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
              <BookOpen className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-text-main">
                {card.title}
              </div>
              <div className="mt-1 text-xs text-slate-500">文档阅读模式</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onEdit?.(card)}
              className="flex h-10 items-center gap-2 rounded-xl border border-border px-3 text-sm font-medium text-slate-700"
            >
              <Pencil className="h-4 w-4" />
              编辑
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-border text-slate-600"
              aria-label="关闭阅读模式"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <article className="mx-auto max-w-4xl px-6 py-10">
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
            </div>

            <h1 className="mt-6 text-4xl font-semibold leading-tight text-text-main">
              {card.title}
            </h1>
            {card.subtitle ? (
              <p className="mt-3 text-xl leading-8 text-slate-600">
                {card.subtitle}
              </p>
            ) : null}
            <p className="mt-5 text-lg leading-9 text-slate-700">
              {card.description}
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              {card.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-border bg-white px-3 py-1 text-sm font-medium text-slate-600"
                >
                  {tag}
                </span>
              ))}
            </div>

            {cover ? (
              <figure className="mt-8 overflow-hidden rounded-2xl border border-border bg-slate-50">
                <div className="flex max-h-[70vh] items-center justify-center">
                  <AsyncImage
                    src={cover.url}
                    alt={cover.title ?? card.title}
                    className="h-auto max-h-[70vh] w-auto max-w-full object-contain"
                  />
                </div>
                {cover.caption ? (
                  <figcaption className="border-t border-border bg-white px-5 py-4 text-sm text-slate-500">
                    {cover.caption}
                  </figcaption>
                ) : null}
              </figure>
            ) : null}

            {card.images.filter((img) => img.id !== cover?.id).length > 0 ? (
              <div className="mt-6 space-y-4">
                {card.images
                  .filter((img) => img.id !== cover?.id)
                  .map((img) => (
                    <figure
                      key={img.id}
                      className="overflow-hidden rounded-2xl border border-border bg-slate-50"
                    >
                      <div className="flex max-h-[70vh] items-center justify-center">
                        <AsyncImage
                          src={img.url}
                          alt={img.title ?? card.title}
                          className="h-auto max-h-[70vh] w-auto max-w-full object-contain"
                        />
                      </div>
                      {img.caption ? (
                        <figcaption className="border-t border-border bg-white px-4 py-3 text-xs text-slate-500">
                          {img.caption}
                        </figcaption>
                      ) : null}
                    </figure>
                  ))}
              </div>
            ) : null}

            <ReaderSection title="问题">
              <p>{card.problem}</p>
            </ReaderSection>

            <ReaderSection title="解决方案">
              <p>{card.solution}</p>
            </ReaderSection>

            <div className="grid gap-8 border-t border-border py-8 md:grid-cols-2">
              <section>
                <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                  收益
                </h3>
                <div className="mt-4 text-base leading-8 text-slate-700">
                  <ListBlock items={card.benefits} />
                </div>
              </section>
              <section>
                <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                  代价
                </h3>
                <div className="mt-4 text-base leading-8 text-slate-700">
                  <ListBlock items={card.costs} />
                </div>
              </section>
            </div>

            <ReaderSection title="权衡取舍">
              <ListBlock items={card.tradeoffs} />
            </ReaderSection>

            <ReaderSection title="适用场景">
              <div className="flex flex-wrap gap-2">
                {card.applicableScenarios.map((scenario) => (
                  <span
                    key={scenario}
                    className="rounded-full border border-border bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600"
                  >
                    {scenario}
                  </span>
                ))}
              </div>
            </ReaderSection>

            <ReaderSection title="心得笔记">
              {card.notes.length ? (
                <div className="space-y-4">
                  {card.notes.map((note) => (
                    <div
                      key={note.id}
                      className="rounded-2xl border border-border bg-slate-50 p-5"
                    >
                      {note.content}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-slate-500">暂未补充心得。</div>
              )}
            </ReaderSection>

            <ReaderSection title="来源">
              {card.sources.length ? (
                <div className="space-y-4">
                  {card.sources.map((source) => (
                    <div key={source.id}>
                      <div className="font-medium text-text-main">
                        {source.url ? (
                          <a
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline decoration-primary/30 underline-offset-2 hover:text-primary"
                          >
                            {source.title}
                          </a>
                        ) : (
                          source.title
                        )}
                      </div>
                      <div className="mt-1 text-sm text-slate-500">
                        {getSourceTypeLabel(source.type)}
                        {source.authors?.length ? ` · ${source.authors.join("、")}` : ""}
                        {source.year ? ` · ${source.year}` : ""}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-slate-500">暂未记录来源。</div>
              )}
            </ReaderSection>

            <ReaderSection title="效果">
              {card.usages.length ? (
                <div className="space-y-5">
                  {card.usages.map((usage) => (
                    <div key={usage.id}>
                      <MarkdownPreview content={usage.result} />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-slate-500">还没有复现效果。</div>
              )}
            </ReaderSection>

            <ReaderSection title="关联卡片">
              {relatedCards.length ? (
                <div className="grid gap-3">
                  {relatedCards.map((relatedCard) => (
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
                  ))}
                </div>
              ) : (
                <div className="text-slate-500">暂无关联卡片。</div>
              )}
            </ReaderSection>
          </article>
        </div>
      </div>
    </div>
  );
}
