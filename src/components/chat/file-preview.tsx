"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { isPreviewableImage } from "@/lib/file-limits";
import { formatFileSize } from "@/lib/format";
import type { SharedFile } from "@/lib/types";
import { FileTypeIcon, fileUrl } from "./file-attachment";

/** テキストとして中身を見せてよい種類（文字として描くだけなので、スクリプトは動かない） */
const TEXT_TYPES = ["application/json", "application/xml", "application/csv"];
/** テキストのプレビューで読む上限。長いファイルは先頭だけ見せる */
const MAX_TEXT_CHARS = 20_000;

type Kind = "image" | "pdf" | "text" | "none";

function previewKind(file: SharedFile): Kind {
  const t = file.mimeType;
  if (isPreviewableImage(t)) return "image";
  if (t === "application/pdf") return "pdf";
  if (t.startsWith("text/") || TEXT_TYPES.includes(t)) return "text";
  return "none";
}

type Loaded =
  | { state: "loading" }
  | { state: "text"; text: string; truncated: boolean }
  | { state: "pdf"; url: string }
  | { state: "error" };

/**
 * 共有ファイルの中身をサイドパネルで見せる（Figma S-09 の「ファイルプレビュー」）。
 *  - 画像：そのまま表示
 *  - テキスト（txt・csv・json など）：文字として表示
 *  - PDF：ブラウザのPDFビューアで表示
 *  - それ以外：プレビューできない旨とダウンロードボタン
 *
 * APIは画像以外を必ずダウンロード扱い（octet-stream）で返すので、PDF・テキストは
 * 一度取ってきてから、こちらで種類を決めて表示する。HTML・SVG はここでも表示しない。
 * ファイルが変わったら key で作り直す前提（状態をリセットするため）
 */
export function FilePreview({
  file,
  roomId,
  guestId,
}: {
  file: SharedFile;
  roomId: string;
  guestId: string;
}) {
  const kind = previewKind(file);
  const [loaded, setLoaded] = useState<Loaded>({ state: "loading" });

  useEffect(() => {
    if (kind !== "text" && kind !== "pdf") return;
    let cancelled = false;
    let objectUrl: string | null = null;

    fetch(fileUrl(roomId, file.id, guestId, true), { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        if (kind === "text") {
          const text = await res.text();
          if (cancelled) return;
          setLoaded({
            state: "text",
            text: text.slice(0, MAX_TEXT_CHARS),
            truncated: text.length > MAX_TEXT_CHARS,
          });
        } else {
          const blob = await res.blob();
          if (cancelled) return;
          objectUrl = URL.createObjectURL(new Blob([blob], { type: "application/pdf" }));
          setLoaded({ state: "pdf", url: objectUrl });
        }
      })
      .catch(() => !cancelled && setLoaded({ state: "error" }));

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [kind, roomId, file.id, guestId]);

  const download = (
    <a
      href={fileUrl(roomId, file.id, guestId, true)}
      download={file.name}
      className="inline-flex items-center gap-1.5 rounded-full border border-line bg-card px-3 py-1.5 text-xs font-medium hover:bg-cloud-pale"
    >
      <Download className="size-3.5" aria-hidden />
      ダウンロード
    </a>
  );

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex items-center gap-2">
        <FileTypeIcon file={file} className="size-4 shrink-0 text-ink-muted" />
        <p className="min-w-0 flex-1 truncate text-sm font-semibold">{file.name}</p>
        {download}
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-line bg-paper">
        {kind === "image" && (
          // 認証付きのAPIから出す画像なので next/image ではなく img を使う
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={fileUrl(roomId, file.id, guestId)}
            alt={file.name}
            className="mx-auto max-h-full max-w-full object-contain"
          />
        )}

        {kind === "none" && (
          <p className="px-4 py-6 text-center text-xs leading-relaxed text-ink-muted">
            このファイル（{formatFileSize(file.size)}）はプレビューできません。
            <br />
            ダウンロードして開いてください。
          </p>
        )}

        {(kind === "text" || kind === "pdf") && loaded.state === "loading" && (
          <p className="px-4 py-6 text-center text-xs text-ink-muted">読み込み中…</p>
        )}
        {loaded.state === "error" && (
          <p className="px-4 py-6 text-center text-xs text-ink-muted">
            読み込めませんでした。ダウンロードして開いてください。
          </p>
        )}
        {loaded.state === "text" && (
          <pre className="whitespace-pre-wrap break-words p-4 font-sans text-sm leading-relaxed">
            {loaded.text}
            {loaded.truncated && (
              <span className="mt-3 block text-xs text-ink-muted">
                …長いので先頭だけ表示しています
              </span>
            )}
          </pre>
        )}
        {loaded.state === "pdf" && (
          <iframe src={loaded.url} title={file.name} className="size-full min-h-80" />
        )}
      </div>
    </div>
  );
}
