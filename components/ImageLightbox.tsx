"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";

type ImageLightboxProps = {
  src: string;
  alt?: string;
  onClose: () => void;
};

export function ImageLightbox({ src, alt, onClose }: ImageLightboxProps) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const draggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const offsetStartRef = useRef({ x: 0, y: 0 });

  const reset = useCallback(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "0") reset();
      if (e.key === "+" || e.key === "=") setScale((s) => Math.min(s + 0.25, 5));
      if (e.key === "-") setScale((s) => Math.max(s - 0.25, 0.25));
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, reset]);

  // Wheel zoom (non-passive so preventDefault works)
  useEffect(() => {
    const el = document.querySelector("[data-lightbox-root]") as HTMLElement | null;
    if (!el) return;
    function onWheel(e: Event) {
      e.preventDefault();
      const w = e as WheelEvent;
      const delta = -w.deltaY * 0.002;
      setScale((prev) => Math.min(Math.max(prev + delta, 0.25), 5));
    }
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // Mouse drag — only active while mouse button is held
  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!draggingRef.current) return;
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      setOffset({
        x: offsetStartRef.current.x + dx,
        y: offsetStartRef.current.y + dy
      });
    }
    function onUp() {
      draggingRef.current = false;
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Only left button
      if (e.button !== 0) return;
      e.preventDefault();
      dragStartRef.current = { x: e.clientX, y: e.clientY };
      offsetStartRef.current = { x: offset.x, y: offset.y };
      draggingRef.current = true;
    },
    [offset]
  );

  const handleDoubleClick = useCallback(() => {
    if (scale > 1) {
      setScale(1);
      setOffset({ x: 0, y: 0 });
    } else {
      setScale(2);
    }
  }, [scale]);

  return (
    <div
      data-lightbox-root
      className="fixed inset-0 z-[60] bg-slate-950/80"
      style={{ cursor: draggingRef.current ? "grabbing" : scale > 1 ? "grab" : "zoom-in" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Toolbar */}
      <div className="absolute right-4 top-4 z-10 flex items-center gap-2">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setScale((s) => Math.min(s + 0.25, 5)); }}
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/90 text-slate-700 shadow-md hover:bg-white"
          aria-label="放大"
        >
          <ZoomIn className="h-4 w-4" />
        </button>
        <span className="min-w-[3rem] rounded-lg bg-white/90 px-2 py-1 text-center text-xs font-medium text-slate-700 shadow-md">
          {Math.round(scale * 100)}%
        </span>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setScale((s) => Math.max(s - 0.25, 0.25)); }}
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/90 text-slate-700 shadow-md hover:bg-white"
          aria-label="缩小"
        >
          <ZoomOut className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); reset(); }}
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/90 text-slate-700 shadow-md hover:bg-white"
          aria-label="重置"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/90 text-slate-700 shadow-md hover:bg-white"
          aria-label="关闭"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Image — receives mouse events directly */}
      <div className="absolute inset-0 flex items-center justify-center">
        <img
          src={src}
          alt={alt ?? ""}
          className="max-h-[95vh] max-w-[95vw] select-none"
          style={{
            objectFit: "contain",
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            transition: draggingRef.current ? "none" : "transform 0.2s ease-out",
          }}
          onMouseDown={handleMouseDown}
          onDoubleClick={handleDoubleClick}
          draggable={false}
        />
      </div>
    </div>
  );
}
