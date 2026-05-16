"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type MenuItem = {
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
  dividerAfter?: boolean;
};

export type ContextMenuProps = {
  x: number;
  y: number;
  items: MenuItem[];
  onClose: () => void;
};

const MENU_ITEM_HEIGHT = 36;
const MENU_PADDING = 8;
const MENU_MAX_HEIGHT = 320;

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  useEffect(() => {
    if (!menuRef.current) return;

    const menu = menuRef.current;
    const rect = menu.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let adjustedX = x;
    let adjustedY = y;

    if (x + rect.width > viewportWidth) {
      adjustedX = viewportWidth - rect.width - 8;
    }

    if (y + rect.height > viewportHeight) {
      adjustedY = viewportHeight - rect.height - 8;
    }

    if (adjustedX < 8) adjustedX = 8;
    if (adjustedY < 8) adjustedY = 8;

    menu.style.left = `${adjustedX}px`;
    menu.style.top = `${adjustedY}px`;
  }, [x, y]);

  if (typeof window === "undefined") return null;

  const menuHeight = Math.min(
    items.length * MENU_ITEM_HEIGHT + MENU_PADDING * 2,
    MENU_MAX_HEIGHT
  );

  return createPortal(
    <div
      ref={menuRef}
      className="fixed z-[300] min-w-[160px] overflow-hidden rounded-xl border border-border bg-white py-1 shadow-lg animate-in fade-in zoom-in-95 duration-75"
      style={{ left: x, top: y }}
    >
      {items.map((item, index) => {
        const Icon = item.icon;

        return (
          <div key={item.label}>
            <button
              type="button"
              onClick={() => {
                if (!item.disabled) {
                  item.onClick();
                  onClose();
                }
              }}
              disabled={item.disabled}
              className={cn(
                "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition",
                item.disabled
                  ? "cursor-not-allowed text-slate-300"
                  : item.danger
                    ? "text-rose-600 hover:bg-rose-50"
                    : "text-slate-700 hover:bg-slate-100"
              )}
            >
              {Icon ? <Icon className="h-4 w-4 shrink-0" /> : <span className="w-4" />}
              <span className="flex-1 truncate">{item.label}</span>
            </button>
            {item.dividerAfter && index < items.length - 1 && (
              <div className="my-1 border-t border-border" />
            )}
          </div>
        );
      })}
    </div>,
    document.body
  );
}