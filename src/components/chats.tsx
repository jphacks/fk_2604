"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { FolderOpen, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AttachMenu } from "@/components/chat/attach-menu";
import { FileAttachment } from "@/components/chat/file-attachment";
import { SharedFiles } from "@/components/chat/shared-files";
import { UploadStatus } from "@/components/chat/upload-status";
import { useFileUpload } from "@/hooks/useFileUpload";
import { formatExpiryDate, formatTime } from "@/lib/format";
import type {
  Member,
  Message,
  MessagesResponse,
  RoomInfo,
  SharedFile,
} from "@/lib/types";
import { cn } from "@/lib/utils";

/* ============================================================
 * chats.tsx：チャット画面（S-09）に必要な機能をすべて集約したファイル
 *  1. 定数・型
 *  2. 小さな関数（人数の整形。時刻・消滅日は lib/format.ts）
 *  3. ページ本体（状態管理・通信）
 *  4. 画面の描画（ニックネーム入力 / 満員・消滅 / チャット）
 * ============================================================ */

/* ---------- 1. 定数・型 ---------- */

type Identity = Member;
type Status = "loading" | "ok" | "gone" | "full" | "error";

const STORAGE_KEY = "ephemeral-chat:identity";
const POLL_MS = 2500; // 新着を取りに行く間隔

/* ---------- 2. 小さな関数 ---------- */

// 上限なしなら「4 人」、上限ありなら「4 / 10 人」
function formatMembers(count: number, max: number | null | undefined) {
  return max ? `${count} / ${max} 人` : `${count} 人`;
}

/* ---------- 3. ページ本体 ---------- */

// roomId は app/rooms/[roomId]/page.tsx から受け取る
export function Chats({ roomId }: { roomId: string }) {

  // --- 状態 ---
  const [me, setMe] = useState<Identity | null>(null);
  const [ready, setReady] = useState(false); // localStorageの確認が終わったか
  const [nameInput, setNameInput] = useState("");

  const [messages, setMessages] = useState<Message[]>([]);
  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [memberCount, setMemberCount] = useState(0);
  const [members, setMembers] = useState<Member[]>([]);
  const [files, setFiles] = useState<SharedFile[]>([]); // 共有ファイル一覧
  const [status, setStatus] = useState<Status>("loading");
  const [dragging, setDragging] = useState(false); // ファイルをドラッグ中か
  const [filesOpen, setFilesOpen] = useState(false); // スマホの共有ファイル一覧

  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const cursor = useRef(0); // どこまでメッセージを受け取ったか
  const fetching = useRef(false); // 取得の二重実行を防ぐ（同じメッセージが重複するため）
  const composing = useRef(false); // 日本語変換中のEnterを送信と誤認しないため
  const bottomRef = useRef<HTMLDivElement>(null);

  // --- ブラウザに保存した一時ID＋ニックネームを読み込む ---
  // 仮の本人確認。本番は入室フォーム＋署名付きCookieに置き換える
  // sessionStorage はタブごとに別なので、同じブラウザの別タブ＝別の参加者として試せる
  useEffect(() => {
    const initialize = window.setTimeout(() => {
      try {
        const saved = sessionStorage.getItem(STORAGE_KEY);
        if (saved) setMe(JSON.parse(saved));
      } catch {}
      setReady(true);
    }, 0);
    return () => clearTimeout(initialize);
  }, []);

  // --- 新着メッセージの取得 ---
  const fetchNew = useCallback(async () => {
    if (!me || fetching.current) return;
    fetching.current = true;
    const qs = new URLSearchParams({
      guestId: me.guestId,
      nickname: me.nickname,
      cursor: String(cursor.current),
    });
    try {
      const res = await fetch(`/api/rooms/${roomId}/messages?${qs}`, {
        cache: "no-store",
      });
      if (res.status === 404) return setStatus("gone");
      if (res.status === 403) return setStatus("full");
      if (!res.ok) return setStatus("error");
      const data: MessagesResponse = await res.json();
      cursor.current = data.nextCursor;
      setRoom(data.room);
      setMemberCount(data.memberCount);
      setMembers(data.members);
      setFiles(data.files ?? []);
      setStatus("ok");
      if (data.messages.length > 0) {
        setMessages((prev) => {
          const seen = new Set(prev.map((m) => m.id));
          return [...prev, ...data.messages.filter((m) => !seen.has(m.id))];
        });
      }
    } catch {
      setStatus("error");
    } finally {
      fetching.current = false;
    }
  }, [roomId, me]);

  // 一定間隔で取得（ポーリング）。後でPusher等に替えるならここだけ変える
  useEffect(() => {
    if (!me) return;
    const initialFetch = window.setTimeout(() => void fetchNew(), 0);
    const t = setInterval(fetchNew, POLL_MS);
    return () => {
      clearTimeout(initialFetch);
      clearInterval(t);
    };
  }, [fetchNew, me]);

  // --- ファイル共有 ---
  // アップロードが終わったら、すぐ新着を取りに行ってチャットに反映する
  const { upload, uploading, error: uploadError, clearError } = useFileUpload(
    roomId,
    me,
    fetchNew,
  );

  // 新着が来たら一番下までスクロール
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // --- 送信 ---
  async function send() {
    const body = text.trim();
    if (!me || !body || sending) return;
    setSending(true);
    const res = await fetch(`/api/rooms/${roomId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...me, body }),
    });
    if (res.ok) {
      setText("");
      await fetchNew(); // 送信後すぐ反映
    }
    setSending(false);
  }

  /* ---------- 4. 画面の描画 ---------- */

  if (!ready) return null;

  // (a) ニックネーム入力（仮の入室フォーム）
  if (!me) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-slate-100 p-4">
        <form
          className="w-full max-w-sm space-y-4 rounded-xl bg-white p-6 shadow"
          onSubmit={(e) => {
            e.preventDefault();
            const nickname = nameInput.trim();
            if (!nickname) return;
            const identity = { guestId: crypto.randomUUID(), nickname };
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
            setMe(identity);
          }}
        >
          <h1 className="text-lg font-bold">ニックネームを入力</h1>
          <Input
            value={nameInput}
            maxLength={20}
            placeholder="例：もえ"
            onChange={(e) => setNameInput(e.target.value)}
          />
          <Button type="submit" className="w-full" disabled={!nameInput.trim()}>
            入室
          </Button>
        </form>
      </main>
    );
  }

  // (b) 満員・消滅
  if (status === "gone" || status === "full") {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-2 bg-slate-100 p-4 text-center">
        <p className="text-lg font-bold">
          {status === "gone" ? "このルームは消滅しました" : "このルームは満員です"}
        </p>
        <p className="text-sm text-slate-500">
          {status === "gone"
            ? "メッセージはすべて削除されています。"
            : "参加人数の上限に達しています。"}
        </p>
      </main>
    );
  }

  // (c) チャット本体
  // 自分を先頭に、サーバーから受け取った参加者を並べる
  const participants = [me, ...members.filter((p) => p.guestId !== me.guestId)];

  return (
    <div className="flex h-dvh bg-slate-100">
      {/* 左サイドバー（PCのみ）：ルーム情報・消滅日・参加者一覧 */}
      <aside className="hidden w-72 shrink-0 flex-col border-r bg-white md:flex">
        <div className="flex items-center gap-2 border-b px-4 py-3">
          {/* 管理者→/dashboard、ゲスト→退室確認になる予定。今は仮でトップへ */}
          <Link
            href="/"
            className="rounded-md px-2 py-1 text-lg hover:bg-slate-100"
            aria-label="戻る"
          >
            ←
          </Link>
          <h1 className="truncate text-base font-bold">
            {room?.name ?? "読み込み中…"}
          </h1>
        </div>

        <div className="border-b px-4 py-5 text-center">
          <p className="text-xs text-slate-400">消滅日</p>
          <p className="mt-1 text-3xl font-bold tabular-nums text-rose-500">
            {formatExpiryDate(room?.expiresAt, "long")}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {room ? `${formatTime(room.expiresAt)} に消滅` : ""}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          <p className="mb-2 text-xs font-semibold text-slate-500">
            参加者 {formatMembers(memberCount, room?.maxMembers)}
          </p>
          <ul className="space-y-1">
            {participants.map((p) => (
              <li
                key={p.guestId}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm"
              >
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-300 text-xs font-bold text-slate-700"
                  aria-hidden
                >
                  {p.nickname.slice(0, 1)}
                </span>
                <span className="truncate">{p.nickname}</span>
                {p.guestId === me.guestId && (
                  <span className="text-xs text-slate-400">（あなた）</span>
                )}
              </li>
            ))}
          </ul>

          <div className="mt-6">
            <SharedFiles files={files} roomId={roomId} guestId={me.guestId} />
          </div>
        </div>
      </aside>

      {/* ファイルをこの範囲にドラッグ＆ドロップしても共有できる */}
      <div
        className="relative flex min-w-0 flex-1 flex-col"
        onDragOver={(e) => {
          if (!e.dataTransfer.types.includes("Files")) return;
          e.preventDefault(); // これがないとドロップできない
          setDragging(true);
        }}
        onDragLeave={(e) => {
          // 子要素の上に移っただけのときは消さない
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false);
        }}
        onDrop={(e) => {
          if (!e.dataTransfer.types.includes("Files")) return;
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files[0];
          if (file) upload(file);
        }}
      >
        {dragging && (
          <div className="pointer-events-none absolute inset-2 z-30 flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-cloud bg-cloud-pale/90 text-ink">
            <Upload className="size-8" aria-hidden />
            <p className="text-sm font-medium">ここにドロップして共有</p>
          </div>
        )}

        {/* ヘッダー：PCではルーム名、スマホでは戻る・人数・消滅日も表示 */}
        <header className="flex items-center gap-3 border-b bg-white px-3 py-2 md:px-6 md:py-3">
          <Link href="/" className="px-2 text-xl md:hidden" aria-label="戻る">
            ←
          </Link>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-bold md:text-lg">
              {room?.name ?? "読み込み中…"}
            </h2>
            <p className="text-xs text-slate-500 md:hidden">
              {formatMembers(memberCount, room?.maxMembers)}
            </p>
          </div>
          {/* スマホ：サイドバーがないので、ボタンで共有ファイル一覧を開く */}
          <button
            type="button"
            onClick={() => setFilesOpen((v) => !v)}
            aria-expanded={filesOpen}
            aria-label="共有ファイル"
            className="relative rounded-full p-2 text-ink hover:bg-cloud-pale md:hidden"
          >
            <FolderOpen className="size-5" />
            {files.length > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-cloud px-1 text-[10px] font-bold text-ink">
                {files.length}
              </span>
            )}
          </button>
          <div className="text-right md:hidden">
            <p className="text-[10px] text-slate-400">消滅日</p>
            <p className="text-sm font-bold tabular-nums text-rose-500">
              {formatExpiryDate(room?.expiresAt, "short")}
            </p>
          </div>
        </header>

        {filesOpen && (
          <div className="max-h-[50dvh] overflow-y-auto border-b bg-white px-4 py-3 md:hidden">
            <SharedFiles files={files} roomId={roomId} guestId={me.guestId} />
          </div>
        )}

        {status === "error" && (
          <p className="bg-amber-100 px-3 py-1 text-center text-xs text-amber-800">
            通信に失敗しました。再接続を試みています…
          </p>
        )}

        {/* メッセージ一覧：自分は右・緑、他人は左・白＋丸アイコン */}
        <div className="flex-1 overflow-y-auto px-3 py-4 md:px-8 md:py-6">
          <div className="mx-auto max-w-4xl space-y-3">
            {messages.length === 0 && (
              <p className="pt-10 text-center text-sm text-slate-400">
                まだメッセージはありません。最初の一言をどうぞ。
              </p>
            )}
            {messages.map((m) => {
              const isMine = m.senderId === me.guestId;
              return (
                <div
                  key={m.id}
                  className={cn("flex items-end gap-2", isMine && "flex-row-reverse")}
                >
                  {!isMine && (
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-300 text-sm font-bold text-slate-700"
                      aria-hidden
                    >
                      {m.nickname.slice(0, 1)}
                    </div>
                  )}
                  <div
                    className={cn(
                      "flex max-w-[75%] flex-col md:max-w-[60%]",
                      isMine && "items-end",
                    )}
                  >
                    {!isMine && (
                      <span className="mb-0.5 px-1 text-xs text-slate-500">
                        {m.nickname}
                      </span>
                    )}
                    <div
                      className={cn("flex items-end gap-1.5", isMine && "flex-row-reverse")}
                    >
                      {m.file ? (
                        // ファイル共有のメッセージは、吹き出しの代わりにファイルのカードを出す
                        <FileAttachment
                          file={m.file}
                          roomId={roomId}
                          guestId={me.guestId}
                          isMine={isMine}
                        />
                      ) : (
                        <p
                          className={cn(
                            "whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm leading-relaxed shadow-sm",
                            isMine
                              ? "rounded-br-sm bg-emerald-500 text-white"
                              : "rounded-bl-sm bg-white text-slate-900",
                          )}
                        >
                          {m.body}
                        </p>
                      )}
                      <time className="shrink-0 text-[10px] text-slate-400">
                        {formatTime(m.sentAt)}
                      </time>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        </div>

        {/* 入力欄 */}
        <div className="border-t bg-white p-3 md:px-8 md:py-4">
          <div className="mx-auto max-w-4xl">
            <UploadStatus
              uploading={uploading}
              error={uploadError}
              onCloseError={clearError}
            />
          </div>
          <div className="mx-auto flex max-w-4xl items-end gap-2">
            {/* 「＋」メニュー：ファイル共有（消えるノートは準備中） */}
            <AttachMenu onSelectFile={upload} disabled={!!uploading} />
            <textarea
              value={text}
              rows={1}
              maxLength={1000}
              placeholder="メッセージを入力（Enterで送信 / Shift+Enterで改行）"
              className="max-h-32 min-h-9 flex-1 resize-none rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
              onChange={(e) => setText(e.target.value)}
              onCompositionStart={() => (composing.current = true)}
              onCompositionEnd={() => (composing.current = false)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !composing.current) {
                  e.preventDefault();
                  send();
                }
              }}
            />
            <Button type="button" onClick={send} disabled={sending || !text.trim()}>
              送信
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
