"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { Collection } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ContextMenu, type MenuItem } from "@/components/ui/ContextMenu";
import { useState } from "react";

type CollectionTabsProps = {
  collections: Collection[];
  activeCollectionId: string;
  counts: Record<string, number>;
  onChange: (collectionId: string) => void;
  onEditCollection?: (collection: Collection) => void;
  onDeleteCollection?: (collection: Collection) => void;
  onCreateCollection?: () => void;
};

export function CollectionTabs({
  collections,
  activeCollectionId,
  counts,
  onChange,
  onEditCollection,
  onDeleteCollection,
  onCreateCollection
}: CollectionTabsProps) {
  const [ctxMenu, setCtxMenu] = useState<{
    x: number;
    y: number;
    items: MenuItem[];
  } | null>(null);

  const items = [
    {
      id: "all",
      name: "全部",
      color: "#1E40AF",
      count: Object.values(counts).reduce((sum, count) => sum + count, 0)
    },
    ...collections.map((collection) => ({
      id: collection.id,
      name: collection.name,
      color: collection.color,
      count: counts[collection.id] ?? 0
    }))
  ];

  return (
    <>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {items.map((item) => {
          const selected = item.id === activeCollectionId;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChange(item.id)}
              onContextMenu={(e) => {
                if (item.id === "all") return;
                e.preventDefault();
                const collection = collections.find((c) => c.id === item.id);
                if (!collection) return;

                const menuItems: MenuItem[] = [];
                if (onEditCollection) {
                  menuItems.push({
                    label: "重命名",
                    icon: Pencil,
                    onClick: () => onEditCollection(collection)
                  });
                }
                menuItems.push({
                  label: "在卡片墙查看",
                  onClick: () => {
                    window.location.href = `/cards?collection=${encodeURIComponent(collection.id)}`;
                  }
                });
                if (onDeleteCollection) {
                  menuItems.push({
                    label: "删除",
                    icon: Trash2,
                    onClick: () => onDeleteCollection(collection),
                    danger: true,
                    dividerAfter: Boolean(onEditCollection || menuItems.length > 1)
                  });
                }

                if (menuItems.length === 0) return;
                setCtxMenu({ x: e.clientX, y: e.clientY, items: menuItems });
              }}
              className={cn(
                "flex shrink-0 items-center gap-3 rounded-xl border px-4 py-3 text-left transition",
                selected
                  ? "border-transparent bg-slate-900 text-white shadow-soft"
                  : "border-border bg-white text-text-main hover:border-slate-300"
              )}
            >
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-sm font-medium">{item.name}</span>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs",
                  selected ? "bg-white/15 text-white" : "bg-slate-100 text-slate-600"
                )}
              >
                {item.count}
              </span>
            </button>
          );
        })}
        {onCreateCollection ? (
          <button
            type="button"
            onClick={onCreateCollection}
            className="flex shrink-0 items-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-3 text-sm font-medium text-slate-400 transition hover:border-primary hover:text-primary"
          >
            <Plus className="h-3.5 w-3.5" />
            新建
          </button>
        ) : null}
      </div>

      {ctxMenu ? (
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          items={ctxMenu.items}
          onClose={() => setCtxMenu(null)}
        />
      ) : null}
    </>
  );
}