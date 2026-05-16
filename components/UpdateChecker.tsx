"use client";

import { APP_VERSION, GITHUB_REPO } from "@/lib/version";

const STORAGE_KEY = "trick-cards.update-dismissed";

type UpdateInfo = {
  version: string;
  url: string;
  notes: string;
};

async function fetchLatestRelease(): Promise<UpdateInfo | null> {
  if (!GITHUB_REPO) return null;
  try {
    const res = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`,
      { headers: { Accept: "application/vnd.github+json" } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const tagName = String(data.tag_name ?? "").replace(/^v/, "");
    if (!tagName || tagName === APP_VERSION) return null;
    return {
      version: tagName,
      url: data.html_url,
      notes: String(data.body ?? "").slice(0, 300)
    };
  } catch {
    return null;
  }
}

function isDismissed(version: string): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(STORAGE_KEY) === version;
}

function dismissVersion(version: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, version);
}

export function UpdateChecker() {
  const [update, setUpdate] = useState<UpdateInfo | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    fetchLatestRelease().then((info) => {
      if (info && !isDismissed(info.version)) {
        setUpdate(info);
      }
    });
  }, []);

  if (!update) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm rounded-2xl border border-emerald-200 bg-emerald-50 shadow-lg px-5 py-4 text-sm animate-modal-panel">
      <div className="font-semibold text-emerald-800">
        发现新版本 v{update.version}
      </div>
      <div className="mt-1 text-emerald-600">当前版本 v{APP_VERSION}</div>
      {update.notes ? (
        <div className="mt-2 text-xs text-slate-500 line-clamp-3">
          {update.notes}
        </div>
      ) : null}
      <div className="mt-3 flex items-center gap-2">
        <a
          href={update.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-9 items-center rounded-xl bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700"
        >
          去下载
        </a>
        <button
          type="button"
          onClick={() => {
            dismissVersion(update.version);
            setUpdate(null);
          }}
          className="flex h-9 items-center rounded-xl border border-emerald-200 px-3 text-sm text-emerald-700 hover:bg-emerald-100"
        >
          忽略此版本
        </button>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";