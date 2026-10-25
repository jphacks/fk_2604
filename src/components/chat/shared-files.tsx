"use client";

import { Download } from "lucide-react";
import { formatFileSize, formatTime } from "@/lib/format";
import type { SharedFile } from "@/lib/types";
import { FileTypeIcon, fileUrl } from "./file-attachment";

/**
 * サイドバーの「共有ファイル」一覧（Figma S-09 の「共有スペース」）。
 * チャットが流れても、ここから共有されたファイルをすぐ探せる。
 */
export function SharedFiles({
  files,
  roomId,
  guestId,
}: {
  files: SharedFile[];
  roomId: string;
  guestId: string;
}) {
  return (
    <section>
      <p className="mb-2 text-xs font-semibold text-ink-muted">
        共有ファイル {files.length > 0 && `${files.length} 件`}
      </p>
      {files.length === 0 ? (
        <p className="rounded-xl bg-cloud-pale px-3 py-3 text-xs leading-relaxed text-ink-muted">
          まだファイルはありません。＋ボタンから共有できます。ファイルもルームと一緒に消えます。
        </p>
      ) : (
        <ul className="space-y-1">
          {files.map((f) => (
            <li key={f.id}>
              <a
                href={fileUrl(roomId, f.id, guestId, true)}
                download={f.name}
                className="group flex items-center gap-2.5 rounded-xl px-2 py-2 text-ink hover:bg-cloud-pale"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-cloud-soft">
                  <FileTypeIcon file={f} className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{f.name}</span>
                  <span className="block truncate text-[11px] text-ink-muted">
                    {f.nickname}・{formatTime(f.uploadedAt)}・{formatFileSize(f.size)}
                  </span>
                </span>
                <Download
                  className="size-4 shrink-0 text-ink-muted opacity-60 group-hover:opacity-100"
                  aria-label="ダウンロード"
                />
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
