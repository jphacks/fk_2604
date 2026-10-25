"use client";

import { Download, FileArchive, FileImage, FileText, File as FileIcon } from "lucide-react";
import { formatFileSize } from "@/lib/format";
import { isPreviewableImage } from "@/lib/file-limits";
import type { SharedFile } from "@/lib/types";
import { cn } from "@/lib/utils";

/** 共有ファイルを取りに行くURL。参加者確認のため guestId を付ける */
export function fileUrl(
  roomId: string,
  fileId: string,
  guestId: string,
  download = false,
) {
  const qs = new URLSearchParams({ guestId });
  if (download) qs.set("download", "1");
  return `/api/rooms/${roomId}/files/${fileId}?${qs}`;
}

/** ファイルの種類に合ったアイコン */
export function FileTypeIcon({ file, className }: { file: SharedFile; className?: string }) {
  const t = file.mimeType;
  const Icon = t.startsWith("image/")
    ? FileImage
    : t.includes("zip") || t.includes("compressed")
      ? FileArchive
      : t.startsWith("text/") || t.includes("pdf") || t.includes("document")
        ? FileText
        : FileIcon;
  return <Icon className={className} aria-hidden />;
}

/**
 * メッセージの吹き出しの中に出す、共有ファイルのカード。
 *  - 画像（png/jpeg/gif/webp）なら小さく表示。押すと別タブで開く
 *  - それ以外はアイコン＋ファイル名＋サイズ。押すとダウンロード
 */
export function FileAttachment({
  file,
  roomId,
  guestId,
  isMine,
}: {
  file: SharedFile;
  roomId: string;
  guestId: string;
  isMine: boolean;
}) {
  const showImage = isPreviewableImage(file.mimeType);

  return (
    <div
      className={cn(
        "w-64 max-w-full overflow-hidden rounded-2xl border shadow-sm",
        isMine ? "rounded-br-sm border-cloud bg-cloud-pale" : "rounded-bl-sm border-line bg-card",
      )}
    >
      {showImage && (
        <a
          href={fileUrl(roomId, file.id, guestId)}
          target="_blank"
          rel="noopener noreferrer"
          className="block bg-paper"
          aria-label={`${file.name} を開く`}
        >
          {/* 認証付きのAPIから出す画像なので next/image ではなく img を使う */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={fileUrl(roomId, file.id, guestId)}
            alt={file.name}
            loading="lazy"
            className="max-h-56 w-full object-cover"
          />
        </a>
      )}
      <a
        href={fileUrl(roomId, file.id, guestId, true)}
        download={file.name}
        className="flex items-center gap-3 px-3 py-2.5 text-ink hover:bg-cloud-soft/40"
      >
        {!showImage && (
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-cloud-soft">
            <FileTypeIcon file={file} className="size-5" />
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{file.name}</span>
          <span className="block text-xs text-ink-muted">{formatFileSize(file.size)}</span>
        </span>
        <Download className="size-4 shrink-0 text-ink-muted" aria-label="ダウンロード" />
      </a>
    </div>
  );
}
