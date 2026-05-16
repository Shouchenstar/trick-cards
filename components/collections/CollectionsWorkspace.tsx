"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  ClipboardCopy,
  Layers3,
  Network,
  NotebookText,
  Pencil,
  Plus,
  Shapes,
  Sparkles,
  Trash2
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ContextMenu, type MenuItem } from "@/components/ui/ContextMenu";
import { useTrickStore } from "@/lib/store/TrickStore";
import { Collection } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";

const colorPalette = [
  "#7C3AED",
  "#2563EB",
  "#16A34A",
  "#0891B2",
  "#9333EA",
  "#F97316",
  "#EC4899",
  "#0F766E",
  "#DC2626",
  "#0EA5E9",
  "#22C55E",
  "#6366F1"
];

type CollectionDraft = {
  name: string;
  color: string;
  description: string;
  icon: string;
};

const emptyDraft: CollectionDraft = {
  name: "",
  color: colorPalette[0],
  description: "",
  icon: "folder"
};

export function CollectionsWorkspace() {
  const router = useRouter();
  const {
    collections,
    cards,
    createCollection,
    updateCollection,
    deleteCollection
  } = useTrickStore();

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingCollection, setEditingCollection] = useState<Collection | null>(
    null
  );
  const [draft, setDraft] = useState<CollectionDraft>(emptyDraft);
  const [deleteTarget, setDeleteTarget] = useState<Collection | null>(null);
  const [deleteReassignTo, setDeleteReassignTo] = useState<string>("");

  const [ctxMenu, setCtxMenu] = useState<{
    x: number;
    y: number;
    items: MenuItem[];
  } | null>(null);

  useEffect(() => {
    if (editingCollection) {
      setDraft({
        name: editingCollection.name,
        color: editingCollection.color,
        description: editingCollection.description ?? "",
        icon: editingCollection.icon ?? "folder"
      });
    } else {
      setDraft(emptyDraft);
    }
  }, [editingCollection]);

  const cardCounts = useMemo(() => {
    return cards.reduce<Record<string, number>>((accumulator, card) => {
      accumulator[card.collectionId] = (accumulator[card.collectionId] ?? 0) + 1;
      return accumulator;
    }, {});
  }, [cards]);

  function openCreateEditor() {
    setEditingCollection(null);
    setEditorOpen(true);
  }

  function openEditEditor(collection: Collection) {
    setEditingCollection(collection);
    setEditorOpen(true);
  }

  function closeEditor() {
    setEditorOpen(false);
    setEditingCollection(null);
  }

  function handleSubmit() {
    const name = draft.name.trim();

    if (!name) {
      window.alert("请输入专栏名称");
      return;
    }

    if (editingCollection) {
      updateCollection(editingCollection.id, {
        name,
        color: draft.color,
        description: draft.description.trim() || undefined,
        icon: draft.icon.trim() || "folder"
      });
    } else {
      createCollection(name, {
        color: draft.color,
        description: draft.description.trim() || undefined,
        icon: draft.icon.trim() || "folder"
      });
    }

    closeEditor();
  }

  function openDeleteDialog(collection: Collection) {
    const fallback = collections.find(
      (current) => current.id !== collection.id
    );
    setDeleteReassignTo(fallback?.id ?? "");
    setDeleteTarget(collection);
  }

  function closeDeleteDialog() {
    setDeleteTarget(null);
    setDeleteReassignTo("");
  }

  function handleConfirmDelete(reassign: boolean) {
    if (!deleteTarget) {
      return;
    }

    const cardsInCollection = cardCounts[deleteTarget.id] ?? 0;

    if (reassign) {
      if (!deleteReassignTo) {
        window.alert("请选择迁移目标专栏");
        return;
      }
      deleteCollection(deleteTarget.id, { reassignTo: deleteReassignTo });
    } else {
      if (cardsInCollection > 0) {
        const confirmed = window.confirm(
          `这个专栏下有 ${cardsInCollection} 张卡片，确认连同卡片一起删除？`
        );

        if (!confirmed) {
          return;
        }
      }
      deleteCollection(deleteTarget.id);
    }

    closeDeleteDialog();
  }

  return (
    <DashboardLayout>
      <div className="space-y-4 px-4 py-4 xl:px-6">
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border/60 bg-surface px-4 py-2 shadow-sm">
          <h2 className="text-sm font-semibold text-text-main">专栏管理</h2>
          <span className="h-4 w-px bg-border" />
          {[
            { label: "专栏", icon: Layers3, value: collections.length },
            { label: "卡片", icon: NotebookText, value: cards.length },
            { label: "已复现", icon: Shapes, value: cards.filter((c) => c.status === "verified").length },
            { label: "可复用场景", icon: Network, value: new Set(cards.flatMap((c) => c.applicableScenarios)).size }
          ].map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="flex items-center gap-1.5 text-xs">
                <Icon className="h-3 w-3 text-primary" />
                <span className="text-slate-500">{s.label}</span>
                <span className="font-semibold text-text-main">{s.value}</span>
              </div>
            );
          })}
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => router.push("/cards")}
              className="flex h-7 items-center gap-1 rounded-lg border border-border bg-white px-2 text-xs font-medium text-slate-600 hover:border-slate-400"
            >
              <ArrowRight className="h-3 w-3" />
              卡片墙
            </button>
            <button
              type="button"
              onClick={openCreateEditor}
              className="flex h-7 items-center gap-1 rounded-lg bg-primary px-2.5 text-xs font-medium text-white"
            >
              <Plus className="h-3 w-3" />
              新建专栏
            </button>
          </div>
        </div>

        <section className="rounded-3xl border border-border/80 bg-surface p-5 shadow-soft">
          <div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-medium text-text-main">所有专栏</div>
              <div className="mt-1 text-sm text-text-secondary">
                {collections.length} 个专栏，覆盖你目前关注的知识领域。
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              改名、改色、删除均会同步到卡片墙、对比和关系图谱。
            </div>
          </div>

          {collections.length ? (
            <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {collections.map((collection) => {
                const count = cardCounts[collection.id] ?? 0;

                return (
                  <article
                    key={collection.id}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setCtxMenu({
                        x: e.clientX,
                        y: e.clientY,
                        items: [
                          { label: "编辑", icon: Pencil, onClick: () => openEditEditor(collection) },
                          { label: "复制名称", icon: ClipboardCopy, onClick: () => navigator.clipboard.writeText(collection.name) },
                          { label: "复制描述", icon: ClipboardCopy, onClick: () => navigator.clipboard.writeText(collection.description ?? "") },
                          { label: "删除", icon: Trash2, onClick: () => openDeleteDialog(collection), danger: true, dividerAfter: true }
                        ]
                      });
                    }}
                    className="flex h-full flex-col rounded-xl border border-border/80 bg-white px-3 py-2.5 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white"
                          style={{ backgroundColor: collection.color }}
                        >
                          <Layers3 className="h-3.5 w-3.5" />
                        </span>
                        <div className="min-w-0">
                          <div className="truncate text-xs font-semibold text-text-main">
                            {collection.name}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {formatDate(collection.updatedAt)}
                          </div>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEditEditor(collection)}
                          className="flex h-6 w-6 items-center justify-center rounded-md border border-border bg-white text-slate-500 hover:text-primary"
                          aria-label="编辑专栏"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openDeleteDialog(collection)}
                          className="flex h-6 w-6 items-center justify-center rounded-md border border-border bg-white text-danger"
                          aria-label="删除专栏"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>

                    <p className="mt-1.5 line-clamp-2 text-[11px] leading-4 text-text-secondary">
                      {collection.description?.trim()
                        ? collection.description
                        : "尚未补充描述。"}
                    </p>

                    <div className="mt-auto flex items-center justify-between pt-2 text-[11px]">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-600">
                        {count} 张卡片
                      </span>
                      <Link
                        href={`/cards?collection=${encodeURIComponent(collection.id)}`}
                        className="inline-flex items-center gap-1 font-medium text-primary"
                      >
                        在卡片墙查看
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-dashed border-border bg-slate-50 p-10 text-center text-sm text-slate-500">
              还没有专栏，先创建第一个领域，例如「大模型 / 多模态」。
            </div>
          )}
        </section>
      </div>

      {editorOpen ? (
        <CollectionEditor
          draft={draft}
          isEditing={Boolean(editingCollection)}
          onChange={setDraft}
          onClose={closeEditor}
          onSubmit={handleSubmit}
        />
      ) : null}

      {deleteTarget ? (
        <DeleteCollectionDialog
          collection={deleteTarget}
          collections={collections}
          cardCount={cardCounts[deleteTarget.id] ?? 0}
          reassignTo={deleteReassignTo}
          onChangeReassign={setDeleteReassignTo}
          onClose={closeDeleteDialog}
          onConfirm={handleConfirmDelete}
        />
      ) : null}

      {ctxMenu ? (
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          items={ctxMenu.items}
          onClose={() => setCtxMenu(null)}
        />
      ) : null}
    </DashboardLayout>
  );
}

const inputClass =
  "w-full rounded-xl border border-border bg-white px-3 py-2.5 text-sm text-text-main outline-none placeholder:text-slate-400 focus:border-primary";

type CollectionEditorProps = {
  draft: CollectionDraft;
  isEditing: boolean;
  onChange: (draft: CollectionDraft) => void;
  onClose: () => void;
  onSubmit: () => void;
};

function CollectionEditor({
  draft,
  isEditing,
  onChange,
  onClose,
  onSubmit
}: CollectionEditorProps) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-6 animate-modal-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-3xl bg-surface shadow-panel animate-modal-panel">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <div className="text-xs font-semibold tracking-[0.18em] text-slate-500">
              {isEditing ? "编辑专栏" : "新建专栏"}
            </div>
            <h2 className="mt-1 text-xl font-semibold text-text-main">
              {isEditing ? "编辑专栏" : "新建专栏"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-border text-slate-500"
            aria-label="关闭"
          >
            ×
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto p-6">
          <Field label="专栏名称">
            <input
              autoFocus
              className={inputClass}
              value={draft.name}
              onChange={(event) =>
                onChange({ ...draft, name: event.target.value })
              }
              placeholder="例如：大模型 / 多模态"
            />
          </Field>

          <Field label="描述">
            <textarea
              className={cn(inputClass, "min-h-[96px] resize-none")}
              value={draft.description}
              onChange={(event) =>
                onChange({ ...draft, description: event.target.value })
              }
              placeholder="简短说明这个专栏聚焦哪些 trick"
            />
          </Field>

          <Field label="主色">
            <div className="flex flex-wrap gap-2">
              {colorPalette.map((color) => (
                <button
                  key={color}
                  type="button"
                  aria-label={`选择主色 ${color}`}
                  onClick={() => onChange({ ...draft, color })}
                  className={cn(
                    "h-9 w-9 rounded-xl border transition",
                    draft.color === color
                      ? "border-slate-900 ring-2 ring-slate-900/20"
                      : "border-transparent"
                  )}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </Field>

        </div>

        <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 items-center justify-center rounded-xl border border-border bg-white px-4 text-sm font-medium text-slate-600"
          >
            取消
          </button>
          <button
            type="button"
            onClick={onSubmit}
            className="flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-medium text-white"
          >
            {isEditing ? "保存修改" : "创建专栏"}
          </button>
        </div>
      </div>
    </div>
  );
}

type DeleteCollectionDialogProps = {
  collection: Collection;
  collections: Collection[];
  cardCount: number;
  reassignTo: string;
  onChangeReassign: (id: string) => void;
  onClose: () => void;
  onConfirm: (reassign: boolean) => void;
};

function DeleteCollectionDialog({
  collection,
  collections,
  cardCount,
  reassignTo,
  onChangeReassign,
  onClose,
  onConfirm
}: DeleteCollectionDialogProps) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const reassignOptions = collections.filter(
    (current) => current.id !== collection.id
  );

  const noCards = cardCount === 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-6 animate-modal-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md rounded-3xl bg-surface p-6 shadow-panel animate-modal-panel">
        <div className="text-xs font-semibold tracking-[0.18em] text-danger">
          删除专栏
        </div>
        <h2 className="mt-1 text-xl font-semibold text-text-main">
          删除「{collection.name}」？
        </h2>
        <p className="mt-2 text-sm leading-6 text-text-secondary">
          {noCards
            ? "这个专栏下没有卡片，可以安全删除。"
            : `这个专栏下有 ${cardCount} 张卡片。可以选择迁移到其他专栏，或连同卡片一起删除。`}
        </p>

        {!noCards ? (
          <div className="mt-4 space-y-2">
            <div className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
              迁移到
            </div>
            <select
              className={inputClass}
              value={reassignTo}
              onChange={(event) => onChangeReassign(event.target.value)}
              disabled={!reassignOptions.length}
            >
              {reassignOptions.length ? (
                reassignOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))
              ) : (
                <option value="">没有其他专栏可选</option>
              )}
            </select>
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 items-center justify-center rounded-xl border border-border bg-white px-4 text-sm font-medium text-slate-600"
          >
            取消
          </button>

          {!noCards && reassignOptions.length ? (
            <button
              type="button"
              onClick={() => onConfirm(true)}
              className="flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-medium text-white"
            >
              迁移并删除
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => onConfirm(false)}
            className="flex h-10 items-center justify-center rounded-xl bg-danger px-4 text-sm font-medium text-white"
          >
            {noCards ? "确认删除" : "连同卡片删除"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-1 text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
        {label}
      </div>
      {children}
    </label>
  );
}
