"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type BottomSheetProps = {
  open: boolean;
  onClose: () => void;
  /** 読み上げ用のタイトル */
  label: string;
  children: ReactNode;
  className?: string;
};

/** スマホで下からせり上がるシート。背景タップ・Escキー・×ボタンで閉じる */
export function BottomSheet({ open, onClose, label, children, className }: BottomSheetProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-ink/30" onClick={onClose}>
      <div
        role="dialog"
        aria-modal
        aria-label={label}
        className={cn(
          "max-h-[80dvh] w-full overflow-y-auto rounded-t-3xl bg-card px-6 pt-4 pb-8 text-ink animate-in slide-in-from-bottom duration-200",
          className,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-2 flex justify-end">
          <button
            type="button"
            aria-label="閉じる"
            onClick={onClose}
            className="flex size-9 items-center justify-center rounded-full hover:bg-cloud-pale"
          >
            <X className="size-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
