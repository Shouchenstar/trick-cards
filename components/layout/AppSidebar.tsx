"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Archive,
  BookOpen,
  Boxes,
  GitCompareArrows,
  KeyRound,
  Layers3,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
  Sunrise
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTrickStore } from "@/lib/store/TrickStore";
import { cn } from "@/lib/utils";
import { isAIConfigComplete, loadAIConfig } from "@/lib/ai/config-client";
import { AISettingsModal } from "@/components/settings/AISettingsModal";
import { TrashModal } from "@/components/trash/TrashModal";

type NavItem = {
  label: string;
  icon: LucideIcon;
  href?: string;
  matchPaths?: string[];
  badgeKey?: "compare" | "collections" | "cards" | "papers";
  comingSoon?: boolean;
};

const navItems: NavItem[] = [
  {
    label: "专栏",
    icon: Layers3,
    href: "/collections",
    matchPaths: ["/", "/collections"],
    badgeKey: "collections"
  },
  {
    label: "卡片",
    icon: Boxes,
    href: "/cards",
    badgeKey: "cards"
  },
  {
    label: "对比",
    icon: GitCompareArrows,
    href: "/compare",
    badgeKey: "compare"
  },
  { label: "知识图谱", icon: Network, href: "/agent" },
  { label: "每日推送", icon: Sunrise, href: "/daily" },
  {
    label: "论文",
    icon: BookOpen,
    href: "/papers",
    badgeKey: "papers"
  }
];

function isActive(pathname: string, item: NavItem) {
  if (!item.href) {
    return false;
  }

  const candidates = item.matchPaths ?? [item.href];
  return candidates.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );
}

type AppSidebarProps = {
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
};

export function AppSidebar({
  collapsed = false,
  onToggleCollapsed
}: AppSidebarProps) {
  const pathname = usePathname() ?? "/";
  const { cards, collections, compareIds, papers, trashCards, trashPapers } = useTrickStore();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [trashOpen, setTrashOpen] = useState(false);
  const [aiConfigured, setAiConfigured] = useState(false);

  useEffect(() => {
    const refresh = () => setAiConfigured(isAIConfigComplete(loadAIConfig()));
    refresh();
    window.addEventListener("trick-cards:ai-config-change", refresh);
    return () =>
      window.removeEventListener("trick-cards:ai-config-change", refresh);
  }, []);

  const badges: Record<NonNullable<NavItem["badgeKey"]>, number> = {
    compare: compareIds.length,
    collections: collections.length,
    cards: cards.length,
    papers: papers.length
  };

  const ToggleIcon = collapsed ? PanelLeftOpen : PanelLeftClose;

  return (
    <>
    <aside
      className={cn(
        "sticky top-0 hidden h-screen self-start overflow-y-auto border-r border-border/80 bg-slate-950 py-5 text-slate-100 lg:flex lg:flex-col",
        collapsed ? "px-2.5 items-center" : "px-4"
      )}
    >
      <div
        className={cn(
          "mb-6 flex items-center gap-3",
          collapsed ? "flex-col gap-2" : ""
        )}
      >
        <Link
          href="/cards"
          aria-label="返回卡片墙首页"
          className={cn(
            "flex items-center gap-3 transition hover:opacity-90",
            collapsed ? "justify-center" : "flex-1"
          )}
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/20 ring-1 ring-blue-400/40">
            <Boxes className="h-5 w-5 text-blue-200" />
          </div>
          {collapsed ? null : (
            <div>
              <div className="text-sm font-semibold tracking-wide text-slate-100">
                Trick Cards
              </div>
              <div className="text-[11px] text-slate-400">
                结构化技术知识库
              </div>
            </div>
          )}
        </Link>

        {onToggleCollapsed ? (
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? "展开侧边栏" : "折叠侧边栏"}
            title={collapsed ? "展开侧边栏" : "折叠侧边栏"}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/10 hover:text-white"
          >
            <ToggleIcon className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      <nav
        className={cn(
          "space-y-1",
          collapsed ? "w-full flex flex-col items-center" : "w-full"
        )}
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(pathname, item);
          const badge =
            !item.comingSoon && item.badgeKey ? badges[item.badgeKey] : 0;

          const baseClass = cn(
            "flex items-center rounded-xl text-sm transition",
            collapsed
              ? "h-11 w-11 justify-center"
              : "h-11 w-full gap-3 px-3 text-left",
            active
              ? "bg-white/10 text-white"
              : "text-slate-400 hover:bg-white/5 hover:text-slate-200",
            (item.comingSoon || !item.href) &&
              "cursor-not-allowed text-slate-500 opacity-70 hover:bg-transparent hover:text-slate-500"
          );

          const iconBadge = badge ? (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-500 px-1 text-[10px] font-medium text-white ring-2 ring-slate-950">
              {badge}
            </span>
          ) : null;

          const expandedRight = item.comingSoon ? (
            <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] tracking-[0.16em] text-slate-500">
              即将上线
            </span>
          ) : badge ? (
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[11px]",
                active ? "bg-white/20 text-white" : "bg-white/10 text-slate-200"
              )}
            >
              {badge}
            </span>
          ) : null;

          const inner = collapsed ? (
            <span className="relative flex h-full w-full items-center justify-center">
              <Icon className="h-4 w-4" />
              {iconBadge}
              {item.comingSoon ? (
                <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-slate-500 ring-2 ring-slate-950" />
              ) : null}
            </span>
          ) : (
            <>
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1 truncate">{item.label}</span>
              {expandedRight}
            </>
          );

          if (item.comingSoon || !item.href) {
            return (
              <button
                key={item.label}
                type="button"
                disabled
                title={`${item.label} · 敬请期待`}
                className={baseClass}
              >
                {inner}
              </button>
            );
          }

          return (
            <Link
              key={item.label}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={baseClass}
            >
              {inner}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto w-full space-y-3 pt-4">
        {/* 垃圾桶入口 */}
        {collapsed ? (
          <button
            type="button"
            onClick={() => setTrashOpen(true)}
            title="回收站"
            className={cn(
              "relative flex h-11 w-11 items-center justify-center rounded-xl text-sm transition",
              (trashCards.length + trashPapers.length) > 0
                ? "text-rose-300 hover:bg-white/10 hover:text-white"
                : "text-slate-500 hover:bg-white/5 hover:text-slate-300"
            )}
          >
            <Archive className="h-4 w-4" />
            {(trashCards.length + trashPapers.length) > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-medium text-white ring-2 ring-slate-950">
                {trashCards.length + trashPapers.length}
              </span>
            )}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setTrashOpen(true)}
            className={cn(
              "flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition",
              (trashCards.length + trashPapers.length) > 0
                ? "border-rose-400/30 bg-rose-500/10 text-rose-100 hover:bg-rose-500/20"
                : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
            )}
          >
            <Archive className="h-4 w-4 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-[10px] uppercase tracking-[0.18em] text-slate-400">
                回收站
              </div>
              <div className="mt-0.5 truncate text-xs font-medium">
                {(trashCards.length + trashPapers.length) > 0
                  ? `${trashCards.length} 张卡片 · ${trashPapers.length} 篇论文`
                  : "暂无删除内容"}
              </div>
            </div>
            {(trashCards.length + trashPapers.length) > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-medium text-white">
                {trashCards.length + trashPapers.length}
              </span>
            )}
          </button>
        )}

        {/* AI 设置 */}
        {collapsed ? (
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            title={aiConfigured ? "AI 设置" : "AI 设置（未配置）"}
            className={cn(
              "relative flex h-11 w-11 items-center justify-center rounded-xl text-sm transition",
              aiConfigured
                ? "text-slate-300 hover:bg-white/10 hover:text-white"
                : "bg-amber-500/15 text-amber-200 ring-1 ring-amber-400/40 hover:bg-amber-500/25"
            )}
          >
            <KeyRound className="h-4 w-4" />
            {aiConfigured ? null : (
              <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-amber-400 ring-2 ring-slate-950" />
            )}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className={cn(
              "flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition",
              aiConfigured
                ? "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
                : "border-amber-400/30 bg-amber-500/10 text-amber-100 hover:bg-amber-500/20"
            )}
          >
            <KeyRound className="h-4 w-4 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-[10px] uppercase tracking-[0.18em] text-slate-400">
                AI 设置
              </div>
              <div className="mt-0.5 truncate text-xs font-medium">
                {aiConfigured ? "已配置 · 点击修改" : "填入你自己的 API Key"}
              </div>
            </div>
            {aiConfigured ? null : (
              <span className="h-2 w-2 shrink-0 rounded-full bg-amber-400" />
            )}
          </button>
        )}
      </div>

      <AISettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />

      <TrashModal
        open={trashOpen}
        onClose={() => setTrashOpen(false)}
      />
    </aside>
    </>
  );
}
