"use client";

import { useEffect } from "react";
import { openExternal } from "@/lib/openExternal";

/**
 * 全局拦截外部链接点击，在 Tauri 环境中用系统浏览器打开。
 * 放在 layout 中挂载一次即可。
 */
export function ExternalLinkHandler() {
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const anchor = (e.target as HTMLElement).closest("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href) return;

      // 只处理外部链接（http/https 开头且 target="_blank"）
      if (
        /^https?:\/\//i.test(href) &&
        anchor.getAttribute("target") === "_blank"
      ) {
        e.preventDefault();
        openExternal(href);
      }
    }

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, []);

  return null;
}
