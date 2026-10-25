"use client";

import { useEffect, useRef, useState } from "react";
import { NotebookPen, Paperclip, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * 入力欄の左にある「＋」ボタンと、押すと開くメニュー（要件定義 S-09）。
 *  - ファイル共有 … ファイル選択の画面を開く
 *  - 消えるノート … まだ作っていないので「準備中」
 *
 * ファイル選択には、見えない <input type="file"> を使い、
 * メニューを押したときに click() で開いている。
 */
export function AttachMenu({
  onSelectFile,
  disabled,
}: {
  onSelectFile: (file: File) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // メニューの外を押す・Escキーで閉じる
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        aria-label="メニューを開く"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex size-10 items-center justify-center rounded-full border border-line bg-card text-ink transition hover:bg-cloud-pale disabled:opacity-50",
          open && "bg-cloud-pale",
        )}
      >
        <Plus className={cn("size-5 transition-transform", open && "rotate-45")} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute bottom-12 left-0 z-20 w-56 whitespace-nowrap overflow-hidden rounded-2xl border border-line bg-card p-1.5 text-sm text-ink shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              inputRef.current?.click();
            }}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-cloud-pale"
          >
            <span className="flex size-8 items-center justify-center rounded-full bg-cloud-soft">
              <Paperclip className="size-4" />
            </span>
            ファイル共有
          </button>
          <button
            type="button"
            role="menuitem"
            disabled
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left opacity-50"
          >
            <span className="flex size-8 items-center justify-center rounded-full bg-cloud-pale">
              <NotebookPen className="size-4" />
            </span>
            消えるノート
            <span className="ml-auto text-xs text-ink-muted">準備中</span>
          </button>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onSelectFile(file);
          e.target.value = ""; // 同じファイルをもう一度選べるように空にする
        }}
      />
    </div>
  );
}
