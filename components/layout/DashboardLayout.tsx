"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { AppSidebar } from "@/components/layout/AppSidebar";

const SIDEBAR_WIDTH_KEY = "trick-cards.sidebar-width.v1";
const SIDEBAR_COLLAPSED_KEY = "trick-cards.sidebar-collapsed.v1";
const MIN_SIDEBAR_WIDTH = 220;
const MAX_SIDEBAR_WIDTH = 440;
const DEFAULT_SIDEBAR_WIDTH = 260;
const COLLAPSED_SIDEBAR_WIDTH = 68;

function clampSidebarWidth(width: number) {
  return Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, width));
}

export function DashboardLayout({ children }: { children: ReactNode }) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    if (typeof window === "undefined") return DEFAULT_SIDEBAR_WIDTH;
    const stored = window.localStorage.getItem(SIDEBAR_WIDTH_KEY);
    const parsed = stored ? Number(stored) : NaN;
    return Number.isFinite(parsed) ? clampSidebarWidth(parsed) : DEFAULT_SIDEBAR_WIDTH;
  });
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1";
  });
  const [isDragging, setIsDragging] = useState(false);
  const [storageReady, setStorageReady] = useState(() => typeof window !== "undefined");

  useEffect(() => {
    if (!isDragging || collapsed) {
      return;
    }

    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    function handlePointerMove(event: PointerEvent) {
      setSidebarWidth(clampSidebarWidth(event.clientX));
    }

    function handlePointerUp() {
      setIsDragging(false);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [isDragging, collapsed]);

  useEffect(() => {
    if (!storageReady) {
      return;
    }

    window.localStorage.setItem(SIDEBAR_WIDTH_KEY, String(sidebarWidth));
    window.localStorage.setItem(
      SIDEBAR_COLLAPSED_KEY,
      collapsed ? "1" : "0"
    );
  }, [sidebarWidth, collapsed, storageReady]);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((current) => !current);
  }, []);

  // Check for updates on app start
  useEffect(() => {
    if (typeof window === "undefined") return;

    (async () => {
      try {
        const update = await check();
        if (update?.available) {
          const shouldUpdate = window.confirm(
            `发现新版本 ${update.version}！是否立即更新？\n\n更新说明：\n${update.body || "暂无"}`
          );
          if (shouldUpdate) {
            await update.downloadAndInstall();
            await relaunch();
          }
        }
      } catch (e) {
        console.log("[Updater] 检查更新失败:", e);
      }
    })();
  }, []);

  const effectiveWidth = collapsed ? COLLAPSED_SIDEBAR_WIDTH : sidebarWidth;

  return (
    <div
      className="min-h-screen lg:grid"
      style={{
        gridTemplateColumns: `${effectiveWidth}px ${
          collapsed ? "0px" : "8px"
        } minmax(0, 1fr)`,
        transition: "grid-template-columns 200ms ease"
      }}
    >
      <AppSidebar collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />

      <button
        type="button"
        aria-label="调整左侧导航宽度"
        aria-orientation="vertical"
        aria-hidden={collapsed}
        tabIndex={collapsed ? -1 : 0}
        disabled={collapsed}
        className="group hidden cursor-col-resize bg-slate-950 lg:block"
        onPointerDown={(event) => {
          if (collapsed) return;
          event.preventDefault();
          setIsDragging(true);
        }}
      >
        <span className="block h-full w-full border-l border-slate-800 bg-transparent transition group-hover:bg-blue-500/35" />
      </button>

      <main className="min-w-0">{children}</main>
    </div>
  );
}
