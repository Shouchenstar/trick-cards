"use client";

import type { KeyboardEvent } from "react";
import { Check, GitCompareArrows, LayoutGrid } from "lucide-react";
import { Collection, TrickCard } from "@/lib/types";
import { cn, getCardCover, statusMeta } from "@/lib/utils";
import { AsyncImage } from "@/components/AsyncImage";

type CardTileProps = {
  card: TrickCard;
  collection: Collection;
  selected?: boolean;
  inCompare?: boolean;
  onClick?: () => void;
  onDoubleClick?: () => void;
  onToggleCompare?: () => void;
  onContextMenu?: (event: React.MouseEvent) => void;
};

export function CardTile({
  card,
  collection,
  selected = false,
  inCompare = false,
  onClick,
  onDoubleClick,
  onToggleCompare,
  onContextMenu
}: CardTileProps) {
  const cover = getCardCover(card);
  const status = statusMeta[card.status];

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onClick?.();
    }
  }

  const tagLine = [collection.name, ...card.tags.slice(0, 2)].join(" · ");

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onKeyDown={handleKeyDown}
      onContextMenu={onContextMenu}
      aria-pressed={selected}
      className={cn(
        "group flex h-full cursor-pointer flex-col overflow-hidden rounded-xl border bg-surface text-left shadow-sm transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        selected
          ? "border-primary ring-2 ring-primary/20"
          : "border-border/60 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
      )}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-slate-50">
        {cover ? (
          <AsyncImage
            src={cover.url}
            alt={cover.title ?? card.title}
            className="h-full w-full object-contain p-3 transition duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-slate-300">
            <LayoutGrid className="h-10 w-10" />
          </div>
        )}

        {onToggleCompare ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onToggleCompare();
            }}
            aria-pressed={inCompare}
            aria-label={inCompare ? "移出对比" : "加入对比"}
            title={inCompare ? "移出对比" : "加入对比"}
            className={cn(
              "absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full shadow-md transition-all duration-150",
              inCompare
                ? "bg-emerald-500 text-white"
                : "bg-white/80 text-slate-400 opacity-60 group-hover:opacity-100 group-hover:text-slate-600 hover:!bg-white hover:!text-primary hover:scale-110"
            )}
          >
            {inCompare ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <GitCompareArrows className="h-3.5 w-3.5" />
            )}
          </button>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col px-3 pb-2.5 pt-2">
        <h3 className="line-clamp-1 text-[13px] font-bold leading-5 text-text-main">
          {card.title}
        </h3>

        <p className="mt-0.5 line-clamp-1 text-[11px] leading-4 text-slate-400">
          {tagLine}
        </p>

        <div className="mt-1.5 text-[11px] leading-4 text-text-secondary">
          <p className="line-clamp-2">
            <span className="font-medium text-slate-500">概述：</span>
            {card.description || "—"}
          </p>
        </div>

        <div className="mt-2 flex items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium leading-4",
              status.tone
            )}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", status.dot)} />
            {status.label}
          </span>
          {card.usages?.length ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium leading-4 text-blue-600">
              项目使用过
            </span>
          ) : null}
        </div>
      </div>
    </article>
  );
}
