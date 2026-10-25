"use client";

import { Download } from "lucide-react";
import { formatFileSize, formatTime } from "@/lib/format";
import type { SharedFile } from "@/lib/types";
import { cn } from "@/lib/utils";
import { FileTypeIcon, fileUrl } from "./file-attachment";

/**
 * サイドパネル「共有ファイル」タブの一覧（Figma S-09）。
 * チャットが流れても、ここから共有されたファイルをすぐ探せる。
 * 行を押すとプレビューに表示し、右のアイコンでダウンロードする
 */
export function SharedFiles({
  files,
  roomId,
  guestId,
  selectedId,
  onSelect,
}: {
  files: SharedFile[];
  roomId: string;
  guestId: string;
  selectedId?: string;
  onSelect: (fileId: string) => void;
}) {
  if (files.length === 0) {
    return (
      <p className="rounded-xl bg-cloud-pale px-3 py-3 text-xs leading-relaxed text-ink-muted">
        まだファイルはありません。＋ボタンから共有できます。ファイルもルームと一緒に消えます。
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {files.map((f) => (
        <li
          key={f.id}
          className={cn(
            "flex items-center gap-1 rounded-xl border bg-card pr-1",
            f.id === selectedId ? "border-cloud bg-cloud-pale" : "border-line",
          )}
        >
          <button
            type="button"
            onClick={() => onSelect(f.id)}
            aria-pressed={f.id === selectedId}
            className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl px-3 py-2.5 text-left"
          >
            <FileTypeIcon file={f} className="size-5 shrink-0" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm">{f.name}</span>
              <span className="block truncate text-[11px] text-ink-muted">
                {formatFileSize(f.size)}・{f.nickname}・{formatTime(f.uploadedAt)}
              </span>
            </span>
          </button>
          <a
            href={fileUrl(roomId, f.id, guestId, true)}
            download={f.name}
            aria-label={`${f.name} をダウンロード`}
            className="flex size-8 shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-cloud-soft hover:text-ink"
          >
            <Download className="size-4" aria-hidden />
          </a>
        </li>
      ))}
    </ul>
  );
}
