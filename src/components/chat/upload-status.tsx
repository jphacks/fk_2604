"use client";

import { LoaderCircle, X } from "lucide-react";
import type { UploadState } from "@/hooks/useFileUpload";

/**
 * 入力欄のすぐ上に出す、アップロードの進み具合とエラー。
 * どちらもないときは何も表示しない。
 */
export function UploadStatus({
  uploading,
  error,
  onCloseError,
}: {
  uploading: UploadState | null;
  error: string | null;
  onCloseError: () => void;
}) {
  if (uploading) {
    return (
      <div className="mb-2 flex items-center gap-3 rounded-xl bg-cloud-pale px-3 py-2 text-sm text-ink" role="status">
        <LoaderCircle className="size-4 shrink-0 animate-spin" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block truncate">{uploading.fileName} を送信中…</span>
          <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-cloud-soft">
            <span
              className="block h-full rounded-full bg-cloud transition-[width]"
              style={{ width: `${uploading.progress}%` }}
            />
          </span>
        </span>
        <span className="shrink-0 text-xs tabular-nums text-ink-muted">{uploading.progress}%</span>
      </div>
    );
  }
  if (error) {
    return (
      <div className="mb-2 flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
        <span className="flex-1">{error}</span>
        <button type="button" onClick={onCloseError} aria-label="閉じる" className="rounded p-0.5 hover:bg-red-100">
          <X className="size-4" />
        </button>
      </div>
    );
  }
  return null;
}
