"use client";

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import {
  Archive,
  ArrowLeft,
  Check,
  FileText,
  Trash2,
  X
} from "lucide-react";
import { useTrickStore } from "@/lib/store/TrickStore";
import { cn, formatDate } from "@/lib/utils";
import type { Paper, TrickCard } from "@/lib/types";

type Tab = "cards" | "papers";

export function TrashModal({
  open,
  onClose
}: {
  open: boolean;
  onClose: () => void;
}) {
  const {
    trashCards,
    trashPapers,
    restoreCard,
    restorePaper,
    permanentDeleteCard,
    permanentDeletePaper,
    emptyTrashCards,
    emptyTrashPapers
  } = useTrickStore();

  const [activeTab, setActiveTab] = useState<Tab>("cards");
  const [toast, setToast] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (!open) return;
    // 默认显示有内容的 tab
    if (trashCards.length > 0) {
      setActiveTab("cards");
    } else if (trashPapers.length > 0) {
      setActiveTab("papers");
    }
  }, [open, trashCards.length, trashPapers.length]);

  useEffect(() => {
    if (!toast) return;
    const handle = window.setTimeout(() => setToast(null), 2000);
    return () => window.clearTimeout(handle);
  }, [toast]);

  function showToast(msg: string) {
    setToast(msg);
  }

  function handleRestoreCard(cardId: string) {
    restoreCard(cardId);
    showToast("已恢复到卡片墙");
  }

  function handleRestorePaper(paperId: string) {
    restorePaper(paperId);
    showToast("已恢复到论文库");
  }

  function handlePermanentDeleteCard(cardId: string) {
    if (window.confirm("确定要永久删除这张卡片吗？此操作不可恢复。")) {
      permanentDeleteCard(cardId);
      showToast("已永久删除");
    }
  }

  function handlePermanentDeletePaper(paperId: string) {
    if (window.confirm("确定要永久删除这篇论文吗？此操作不可恢复。")) {
      permanentDeletePaper(paperId);
      showToast("已永久删除");
    }
  }

  function handleEmptyCards() {
    if (window.confirm(`确定要清空所有 ${trashCards.length} 张垃圾桶卡片吗？此操作不可恢复。`)) {
      emptyTrashCards();
      showToast("已清空所有垃圾桶卡片");
    }
  }

  function handleEmptyPapers() {
    if (window.confirm(`确定要清空所有 ${trashPapers.length} 篇垃圾桶论文吗？此操作不可恢复。`)) {
      emptyTrashPapers();
      showToast("已清空所有垃圾桶论文");
    }
  }

  if (!open) return null;

  const cardsCount = trashCards.length;
  const papersCount = trashPapers.length;
  const totalCount = cardsCount + papersCount;

  const modal = (
    <div
      className="fixed inset-0 z-[500] flex items-center justify-center bg-slate-950/55 px-4 py-6 animate-modal-backdrop"
      onMouseDown={() => setIsDragging(false)}
      onMouseMove={(e) => {
        if (e.buttons === 1) setIsDragging(true);
      }}
      onClick={(e) => {
        if (!isDragging && e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-surface shadow-panel animate-modal-panel">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100">
              <Archive className="h-5 w-5 text-slate-600" />
            </div>
            <div>
              <div className="text-[10px] font-semibold tracking-[0.18em] text-slate-500">
                回收站
              </div>
              <h2 className="text-base font-semibold text-text-main">
                已删除的内容
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-border text-slate-500"
            aria-label="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border">
          <button
            type="button"
            onClick={() => setActiveTab("cards")}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition",
              activeTab === "cards"
                ? "border-b-2 border-primary text-primary"
                : "text-slate-500 hover:bg-slate-50"
            )}
          >
            <FileText className="h-4 w-4" />
            卡片
            {cardsCount > 0 && (
              <span className="ml-1 rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] text-slate-700">
                {cardsCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("papers")}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition",
              activeTab === "papers"
                ? "border-b-2 border-primary text-primary"
                : "text-slate-500 hover:bg-slate-50"
            )}
          >
            <FileText className="h-4 w-4" />
            论文
            {papersCount > 0 && (
              <span className="ml-1 rounded-full bg-slate-200 px-1.5 py-0.5 text-[10px] text-slate-700">
                {papersCount}
              </span>
            )}
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === "cards" ? (
            trashCards.length === 0 ? (
              <EmptyState type="cards" />
            ) : (
              <div className="space-y-2">
                {trashCards.map((card) => (
                  <TrashCardItem
                    key={card.id}
                    card={card}
                    onRestore={() => handleRestoreCard(card.id)}
                    onPermanentDelete={() => handlePermanentDeleteCard(card.id)}
                  />
                ))}
              </div>
            )
          ) : trashPapers.length === 0 ? (
            <EmptyState type="papers" />
          ) : (
            <div className="space-y-2">
              {trashPapers.map((paper) => (
                <TrashPaperItem
                  key={paper.id}
                  paper={paper}
                  onRestore={() => handleRestorePaper(paper.id)}
                  onPermanentDelete={() => handlePermanentDeletePaper(paper.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border px-5 py-3">
          <div className="text-xs text-slate-500">
            {totalCount === 0 ? (
              "垃圾桶是空的"
            ) : (
              <>超过 30 天的项目会自动清除</>
            )}
          </div>
          <div className="flex gap-2">
            {activeTab === "cards" && trashCards.length > 0 && (
              <button
                type="button"
                onClick={handleEmptyCards}
                className="flex h-8 items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 text-xs font-medium text-rose-700 hover:bg-rose-100"
              >
                <Trash2 className="h-3 w-3" />
                清空卡片
              </button>
            )}
            {activeTab === "papers" && trashPapers.length > 0 && (
              <button
                type="button"
                onClick={handleEmptyPapers}
                className="flex h-8 items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 text-xs font-medium text-rose-700 hover:bg-rose-100"
              >
                <Trash2 className="h-3 w-3" />
                清空论文
              </button>
            )}
          </div>
        </div>

        {/* Toast */}
        {toast ? (
          <div className="fixed bottom-6 left-1/2 z-[510] -translate-x-1/2 rounded-full bg-slate-900 px-4 py-2 text-xs font-medium text-white shadow-panel">
            {toast}
          </div>
        ) : null}
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

function TrashCardItem({
  card,
  onRestore,
  onPermanentDelete
}: {
  card: TrickCard;
  onRestore: () => void;
  onPermanentDelete: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-white p-3">
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-text-main">
          {card.title}
        </div>
        <div className="mt-0.5 text-[10px] text-slate-500">
          删除于 {formatDate(card.deletedAt ?? "")}
        </div>
      </div>
      <div className="flex shrink-0 gap-1.5">
        <button
          type="button"
          onClick={onRestore}
          className="flex h-7 items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100"
        >
          <ArrowLeft className="h-3 w-3" />
          恢复
        </button>
        <button
          type="button"
          onClick={onPermanentDelete}
          className="flex h-7 items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2 text-[11px] font-medium text-rose-700 hover:bg-rose-100"
        >
          <Trash2 className="h-3 w-3" />
          删除
        </button>
      </div>
    </div>
  );
}

function TrashPaperItem({
  paper,
  onRestore,
  onPermanentDelete
}: {
  paper: Paper;
  onRestore: () => void;
  onPermanentDelete: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-white p-3">
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-text-main">
          {paper.title}
        </div>
        <div className="mt-0.5 text-[10px] text-slate-500">
          删除于 {formatDate(paper.deletedAt ?? "")}
        </div>
      </div>
      <div className="flex shrink-0 gap-1.5">
        <button
          type="button"
          onClick={onRestore}
          className="flex h-7 items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100"
        >
          <ArrowLeft className="h-3 w-3" />
          恢复
        </button>
        <button
          type="button"
          onClick={onPermanentDelete}
          className="flex h-7 items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2 text-[11px] font-medium text-rose-700 hover:bg-rose-100"
        >
          <Trash2 className="h-3 w-3" />
          删除
        </button>
      </div>
    </div>
  );
}

function EmptyState({ type }: { type: "cards" | "papers" }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
        <Check className="h-6 w-6 text-slate-400" />
      </div>
      <div className="mt-3 text-sm font-medium text-text-main">
        {type === "cards" ? "没有删除的卡片" : "没有删除的论文"}
      </div>
      <div className="mt-1 text-xs text-text-secondary">
        {type === "cards"
          ? "删除的卡片会出现在这里"
          : "删除的论文会出现在这里"}
      </div>
    </div>
  );
}