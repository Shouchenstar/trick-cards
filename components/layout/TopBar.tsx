"use client";

import type { LucideIcon } from "lucide-react";
import { Search } from "lucide-react";

type TopBarAction = {
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
  disabled?: boolean;
};

type TopBarProps = {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  searchQuery?: string;
  searchPlaceholder?: string;
  onSearchChange?: (value: string) => void;
  primaryAction?: TopBarAction;
  secondaryAction?: TopBarAction;
};

export function TopBar({
  title,
  subtitle,
  eyebrow = "技术 Trick 知识库",
  searchQuery,
  searchPlaceholder = "搜索标题、标签、描述或专栏",
  onSearchChange,
  primaryAction,
  secondaryAction
}: TopBarProps) {
  const showSearch = typeof onSearchChange === "function";
  const PrimaryIcon = primaryAction?.icon;
  const SecondaryIcon = secondaryAction?.icon;

  return (
    <div className="grid gap-3 border-b border-border/80 bg-surface/80 px-5 py-2.5 backdrop-blur xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center xl:gap-5 xl:px-8">
      <div className="min-w-0">
        {eyebrow ? (
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            {eyebrow}
          </div>
        ) : null}
        <h1 className="mt-0.5 text-sm font-semibold text-text-main">{title}</h1>
        {subtitle ? (
          <p className="mt-0.5 text-[11px] leading-4 text-text-secondary">
            {subtitle}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-3 xl:justify-end">
        {showSearch ? (
          <label className="flex h-9 min-w-[240px] items-center gap-2.5 rounded-lg border border-border bg-white px-2.5 shadow-soft">
            <Search className="h-4 w-4 text-slate-400" />
            <input
              value={searchQuery ?? ""}
              onChange={(event) => onSearchChange?.(event.target.value)}
              placeholder={searchPlaceholder}
              className="w-full border-0 bg-transparent text-sm text-text-main outline-none placeholder:text-slate-400"
            />
          </label>
        ) : null}

        {secondaryAction ? (
          <button
            type="button"
            onClick={secondaryAction.onClick}
            disabled={secondaryAction.disabled}
            className="flex h-9 items-center justify-center gap-1.5 rounded-lg border border-border bg-white px-3 text-xs font-medium text-text-main shadow-soft disabled:cursor-not-allowed disabled:opacity-45"
          >
            {SecondaryIcon ? (
              <SecondaryIcon className="h-4 w-4 text-slate-500" />
            ) : null}
            {secondaryAction.label}
          </button>
        ) : null}

        {primaryAction ? (
          <button
            type="button"
            onClick={primaryAction.onClick}
            disabled={primaryAction.disabled}
            className="flex h-9 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-medium text-white shadow-soft disabled:cursor-not-allowed disabled:opacity-50"
          >
            {PrimaryIcon ? <PrimaryIcon className="h-4 w-4" /> : null}
            {primaryAction.label}
          </button>
        ) : null}
      </div>
    </div>
  );
}
