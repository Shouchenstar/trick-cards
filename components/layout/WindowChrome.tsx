"use client";

import { useEffect, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, Square, X } from "lucide-react";

type WindowChromeProps = {
  contentOffset: number;
};

export function WindowChrome({ contentOffset }: WindowChromeProps) {
  const [desktop, setDesktop] = useState(false);

  useEffect(() => {
    setDesktop(isTauri());
  }, []);

  if (!desktop) {
    return null;
  }

  const appWindow = getCurrentWindow();
  const runWindowAction = (action: () => Promise<void>) => {
    void action().catch((error) => {
      console.error("[Window] 操作失败:", error);
    });
  };

  return (
    <>
      <div
        data-tauri-drag-region
        className="fixed right-[132px] top-0 z-[90] h-9 cursor-default"
        style={{ left: contentOffset }}
        onDoubleClick={() => runWindowAction(() => appWindow.toggleMaximize())}
      />

      <div className="fixed right-0 top-0 z-[100] flex h-9 overflow-hidden rounded-bl-md border-b border-l border-slate-200/80 bg-white/90 text-slate-600 shadow-sm backdrop-blur">
        <button
          type="button"
          title="最小化"
          aria-label="最小化窗口"
          className="flex h-9 w-11 items-center justify-center transition hover:bg-slate-100 hover:text-slate-900"
          onClick={() => runWindowAction(() => appWindow.minimize())}
        >
          <Minus className="h-4 w-4" />
        </button>
        <button
          type="button"
          title="最大化或还原"
          aria-label="最大化或还原窗口"
          className="flex h-9 w-11 items-center justify-center transition hover:bg-slate-100 hover:text-slate-900"
          onClick={() => runWindowAction(() => appWindow.toggleMaximize())}
        >
          <Square className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          title="关闭"
          aria-label="关闭窗口"
          className="flex h-9 w-11 items-center justify-center transition hover:bg-red-500 hover:text-white"
          onClick={() => runWindowAction(() => appWindow.close())}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </>
  );
}
