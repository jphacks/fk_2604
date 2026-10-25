"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  LogOut,
  NotebookPen,
  Paperclip,
  SendHorizontal,
  Settings,
  Upload,
  Users,
} from "lucide-react";
import { AttachMenu } from "@/components/chat/attach-menu";
import { FileAttachment } from "@/components/chat/file-attachment";
import { SharedFiles } from "@/components/chat/shared-files";
import { UploadStatus } from "@/components/chat/upload-status";
import { BottomSheet } from "@/components/common/bottom-sheet";
import { formatDayLabel, formatMembers, isSameDay } from "@/components/common/format";
import { InitialAvatar } from "@/components/common/initial-avatar";
import { PageShell } from "@/components/layout/page-shell";
import { ExpiryDate } from "@/components/room/expiry-date";
import { RoomEnded } from "@/components/room/room-ended";
import { useFileUpload } from "@/hooks/useFileUpload";
import { formatTime } from "@/lib/format";
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
 *  2. 小さな関数（人数・日付区切りは components/common/format.ts、時刻は lib/format.ts）
 *  3. ページ本体（状態管理・通信）
 *  4. 画面の描画（満員・消滅 / チャット）
 * ============================================================ */

/* ---------- 1. 定数・型 ---------- */

type Status = "loading" | "ok" | "gone" | "full" | "error";

const POLL_MS = 2500; // 新着を取りに行く間隔

/* ---------- 2. 小さな関数 ---------- */

// 参加者の名前を「はる・ゆい・けん」のようにつなげる
function joinNames(people: Member[]) {
  return people.map((p) => p.nickname).join("・");
}

/* ---------- 3. ページ本体 ---------- */

// roomId・me・isOwner は app/rooms/[roomId]/page.tsx から受け取る
// me：ログイン中のユーザーID＋招待リンクの入室時に登録したニックネーム
// isOwner：ルームの作成者なら true（設定ボタンを表示する）
export function Chats({
  roomId,
  me,
  isOwner = false,
}: {
  roomId: string;
  me: Member;
  isOwner?: boolean;
}) {

  // --- 状態 ---

  const [messages, setMessages] = useState<Message[]>([]);
  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [memberCount, setMemberCount] = useState(0);
  const [members, setMembers] = useState<Member[]>([]);
  const [files, setFiles] = useState<SharedFile[]>([]); // 共有ファイル一覧
  const [status, setStatus] = useState<Status>("loading");
  const [dragging, setDragging] = useState(false); // ファイルをドラッグ中か
  const [membersOpen, setMembersOpen] = useState(false); // スマホの参加者・共有ファイル一覧
  const [now, setNow] = useState(0); // 「今日」の判定用。取得のたびに更新する

  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const cursor = useRef(0); // どこまでメッセージを受け取ったか
  const fetching = useRef(false); // 取得の二重実行を防ぐ（同じメッセージが重複するため）
  const composing = useRef(false); // 日本語変換中のEnterを送信と誤認しないため
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null); // 「ファイル共有」ボタン用

  // --- 新着メッセージの取得 ---
  const fetchNew = useCallback(async () => {
    if (fetching.current) return;
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
      setNow(Date.now());
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
    const initialFetch = window.setTimeout(() => void fetchNew(), 0);
    const t = setInterval(fetchNew, POLL_MS);
    return () => {
      clearTimeout(initialFetch);
      clearInterval(t);
    };
  }, [fetchNew]);

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
    if (!body || sending) return;
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

  // (a) 満員・消滅
  if (status === "gone" || status === "full") {
    return <RoomEnded reason={status} />;
  }

  // (b) チャット本体
  // 自分を先頭に、サーバーから受け取った参加者を並べる
  const participants = [me, ...members.filter((p) => p.guestId !== me.guestId)];

  // 参加者一覧と共有ファイル（PCは左サイドバー、スマホは下から出るシート）
  const memberPanel = (
    <div className="space-y-6">
      <section>
        <p className="mb-2 text-xs font-semibold text-ink-muted">
          参加者 {formatMembers(memberCount, room?.maxMembers)}
        </p>
        <ul className="space-y-1">
          {participants.map((p) => (
            <li key={p.guestId} className="flex items-center gap-2.5 px-1 py-1.5 text-sm">
              <InitialAvatar name={p.nickname} className="size-8" />
              <span className="truncate">{p.nickname}</span>
              {p.guestId === me.guestId && (
                <span className="text-xs text-ink-muted">（あなた）</span>
              )}
            </li>
          ))}
        </ul>
      </section>
      <SharedFiles files={files} roomId={roomId} guestId={me.guestId} />
    </div>
  );

  return (
    // ナビゲーション：ロゴ／設定（管理者のみ）・退室。画面の高さに固定し、メッセージ一覧だけをスクロールする
    <PageShell
      className="h-dvh"
      logoHref={isOwner ? "/dashboard" : undefined}
      actions={
        <>
          {/* 管理者のみ：歯車アイコンからトークルームの設定へ */}
          {isOwner && (
            <Link
              href={`/rooms/${roomId}/settings`}
              aria-label="トークルームの設定"
              title="トークルームの設定"
              className="flex size-10 items-center justify-center rounded-full hover:bg-cloud-soft"
            >
              <Settings className="size-5" />
            </Link>
          )}
          {/* 管理者→ダッシュボード、ゲスト→トップ（退室確認は今後） */}
          <Link
            href={isOwner ? "/dashboard" : "/"}
            className="flex items-center gap-1.5 rounded-full px-2 py-2 text-[15px] font-medium hover:bg-cloud-soft"
          >
            <LogOut className="size-5" aria-hidden />
            退室
          </Link>
        </>
      }
    >
      <div className="flex min-h-0 flex-1">
        {/* 左サイドバー（PCのみ） */}
        <aside className="hidden w-72 shrink-0 overflow-y-auto border-r border-line bg-card px-5 py-6 md:block">
          {memberPanel}
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

          {/* ルーム情報：ルーム名・人数と参加者・消える日 */}
          <header className="bg-card px-5 pt-4 pb-5 md:px-8">
            <div className="mx-auto max-w-3xl">
              <h1 className="truncate text-2xl font-bold md:text-[28px]">
                {room?.name ?? "読み込み中…"}
              </h1>
              <div className="mt-2 flex items-center gap-3">
                <p className="min-w-0 flex-1 truncate text-sm text-ink-muted">
                  {formatMembers(memberCount, room?.maxMembers)}
                  <span className="ml-3">{joinNames(participants)}</span>
                </p>
                {/* スマホ：サイドバーがないので、ボタンで参加者・共有ファイルを開く */}
                <button
                  type="button"
                  onClick={() => setMembersOpen(true)}
                  aria-label="参加者と共有ファイル"
                  className="relative flex size-9 items-center justify-center rounded-full hover:bg-cloud-pale md:hidden"
                >
                  <Users className="size-5" />
                  {files.length > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-cloud px-1 text-[10px] font-bold">
                      {files.length}
                    </span>
                  )}
                </button>
              </div>
              {/* 要件どおり、残り時間ではなく日付で表示する */}
              <ExpiryDate
                expiresAt={room?.expiresAt}
                now={now}
                className="mt-4 flex items-center justify-between gap-4 rounded-2xl bg-cloud-pale px-5 py-3"
                labelClassName="text-xs"
                dateClassName="text-2xl font-bold md:text-[28px]"
              />
            </div>
          </header>

          {status === "error" && (
            <p className="bg-amber-100 px-3 py-1 text-center text-xs text-amber-800">
              通信に失敗しました。再接続を試みています…
            </p>
          )}

          {/* メッセージ一覧：自分は右・水色、他人は左・白＋丸アイコン */}
          <div className="flex-1 overflow-y-auto px-4 py-5 md:px-8">
            <div className="mx-auto max-w-3xl space-y-5">
              {messages.length === 0 && (
                <p className="pt-10 text-center text-sm text-ink-muted">
                  まだメッセージはありません。最初の一言をどうぞ。
                </p>
              )}
              {messages.map((m, i) => {
                const isMine = m.senderId === me.guestId;
                // 前のメッセージと日付が変わったら「今日　10月24日(土)」の区切りを出す
                const showDay = i === 0 || !isSameDay(messages[i - 1].sentAt, m.sentAt);
                return (
                  <div key={m.id}>
                    {showDay && (
                      <p className="mb-5 text-center text-xs text-ink-muted">
                        {formatDayLabel(m.sentAt, now)}
                      </p>
                    )}
                    <div className={cn("flex items-start gap-3", isMine && "justify-end")}>
                      {!isMine && <InitialAvatar name={m.nickname} className="size-9" />}
                      <div
                        className={cn(
                          "flex max-w-[82%] flex-col md:max-w-[65%]",
                          isMine && "items-end",
                        )}
                      >
                        <p className="mb-1 px-1 text-xs text-ink-muted">
                          {m.nickname}
                          {isMine && "（あなた）"}
                          <time className="ml-3 tabular-nums">{formatTime(m.sentAt)}</time>
                        </p>
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
                              "whitespace-pre-wrap break-words rounded-3xl px-5 py-3 text-[15px] leading-relaxed",
                              isMine ? "bg-cloud-soft" : "bg-card",
                            )}
                          >
                            {m.body}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>
          </div>

          {/* 入力欄 */}
          <div className="border-t border-line bg-card px-4 pt-3 pb-3 md:px-8">
            <div className="mx-auto max-w-3xl">
              <UploadStatus
                uploading={uploading}
                error={uploadError}
                onCloseError={clearError}
              />

              {/* 消えるノート（準備中）・ファイル共有 */}
              <div className="mb-3 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled
                  title="準備中"
                  className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-cloud-pale text-[15px] disabled:opacity-60"
                >
                  <NotebookPen className="size-5" aria-hidden />
                  消えるノート
                </button>
                <button
                  type="button"
                  disabled={!!uploading}
                  onClick={() => fileInputRef.current?.click()}
                  className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-cloud-pale text-[15px] transition hover:bg-cloud-soft disabled:opacity-60"
                >
                  <Paperclip className="size-5" aria-hidden />
                  ファイル共有
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) upload(file);
                    e.target.value = ""; // 同じファイルをもう一度選べるように空にする
                  }}
                />
              </div>

              <div className="flex items-end gap-3">
                {/* 「＋」メニュー：ファイル共有（消えるノートは準備中） */}
                <AttachMenu onSelectFile={upload} disabled={!!uploading} />
                <textarea
                  value={text}
                  rows={1}
                  maxLength={1000}
                  placeholder="メッセージを入力…"
                  aria-label="メッセージ（Enterで送信 / Shift+Enterで改行）"
                  className="max-h-32 min-h-11 flex-1 resize-none rounded-2xl border border-line bg-paper px-4 py-2.5 text-[15px] outline-none placeholder:text-ink-muted focus:border-cloud"
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
                <button
                  type="button"
                  onClick={send}
                  disabled={sending || !text.trim()}
                  aria-label="送信"
                  className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-cloud transition hover:bg-cloud-strong disabled:opacity-50"
                >
                  <SendHorizontal className="size-5" />
                </button>
              </div>

              <p className="mt-3 text-center text-xs text-ink-muted">
                期限がくると、会話・ノート・ファイルは消えます。
              </p>
            </div>
          </div>
        </div>
      </div>

      <BottomSheet
        open={membersOpen}
        onClose={() => setMembersOpen(false)}
        label="参加者と共有ファイル"
      >
        {memberPanel}
      </BottomSheet>
    </PageShell>
  );
}
