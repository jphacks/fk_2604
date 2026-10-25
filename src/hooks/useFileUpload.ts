"use client";

import { useCallback, useState } from "react";
import { formatFileSize } from "@/lib/format";
import { MAX_FILE_BYTES } from "@/lib/file-limits";
import type { Member } from "@/lib/types";

/**
 * ファイルをアップロードするためのフック。
 *
 * fetch ではなく XMLHttpRequest を使っている理由：
 *   fetch は「いま何％送れたか」を取れないが、XMLHttpRequest は取れる。
 *   進み具合のバーを出すためにこちらを使う。
 *
 * 使い方：
 *   const { upload, uploading, progress, error, clearError } = useFileUpload(roomId, me, onDone);
 *   upload(file);
 */

/** サーバーのエラーコード → 画面に出す文 */
const ERROR_TEXT: Record<string, string> = {
  FILE_TOO_LARGE: `ファイルが大きすぎます（上限 ${formatFileSize(MAX_FILE_BYTES)}）`,
  ROOM_STORAGE_FULL: "このルームの共有容量がいっぱいです",
  ROOM_GONE: "ルームが消滅しています",
  NOT_MEMBER: "ルームの参加者ではありません",
  BAD_REQUEST: "ファイルを送れませんでした",
};

export type UploadState = {
  fileName: string;
  progress: number; // 0〜100
};

export function useFileUpload(
  roomId: string,
  me: Member | null,
  /** アップロードが終わったら呼ばれる（新着の取得などに使う） */
  onDone?: () => void,
) {
  const [current, setCurrent] = useState<UploadState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const upload = useCallback(
    (file: File) => {
      if (!me || current) return;
      setError(null);

      // 送る前に確認（サーバーでも同じ確認をしている）
      if (file.size === 0) return setError("空のファイルは共有できません");
      if (file.size > MAX_FILE_BYTES) return setError(ERROR_TEXT.FILE_TOO_LARGE);

      const form = new FormData();
      form.append("file", file);
      form.append("guestId", me.guestId);
      form.append("nickname", me.nickname);

      const xhr = new XMLHttpRequest();
      xhr.open("POST", `/api/rooms/${roomId}/files`);
      setCurrent({ fileName: file.name, progress: 0 });

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          setCurrent({
            fileName: file.name,
            progress: Math.round((e.loaded / e.total) * 100),
          });
        }
      };
      xhr.onload = () => {
        setCurrent(null);
        if (xhr.status >= 200 && xhr.status < 300) {
          onDone?.();
          return;
        }
        let code = "";
        try {
          code = JSON.parse(xhr.responseText).error;
        } catch {}
        setError(ERROR_TEXT[code] ?? "ファイルを送れませんでした");
      };
      xhr.onerror = () => {
        setCurrent(null);
        setError("通信に失敗しました。もう一度お試しください");
      };
      xhr.send(form);
    },
    [roomId, me, current, onDone],
  );

  return {
    upload,
    uploading: current,
    error,
    clearError: () => setError(null),
  };
}
