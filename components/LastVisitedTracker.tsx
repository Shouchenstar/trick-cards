"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

const STORAGE_KEY = "trick-cards.last-visited";

/**
 * 记忆上次访问的路径：
 * - 路径变更时保存到 localStorage
 * - 应用启动落在根路径 "/" 时，自动跳转到上次访问的页面（若存在且非根路径）
 */
export function LastVisitedTracker() {
  const pathname = usePathname();
  const router = useRouter();
  const restoredRef = useRef(false);

  // 启动时尝试恢复
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved && saved !== "/" && pathname === "/") {
        router.replace(saved);
      }
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 路径变更时保存
  useEffect(() => {
    if (!pathname) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, pathname);
    } catch { /* ignore */ }
  }, [pathname]);

  return null;
}
