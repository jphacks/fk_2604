"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { LogOut, Settings } from "lucide-react";
import type { Member, Message, MessagesResponse, RoomInfo } from "@/lib/types";
import { formatMembers } from "@/components/common/format";
import { AppHeader } from "@/components/layout/app-header";
import { BottomSheet } from "@/components/common/bottom-sheet";
import { RoomEnded } from "@/components/room/room-ended";
import { ChatComposer } from "@/components/chat/chat-composer";
import { MessageList } from "@/components/chat/message-list";
import { NicknameForm } from "@/components/chat/nickname-form";
import { RoomHeader } from "@/components/chat/room-header";
import { RoomInfoPanel } from "@/components/chat/room-info-panel";

/* ============================================================
 * chats.tsx：チャット画面（S-09）
 *
 * このファイルは「データの取得・送信（ロジック）」と「部品の組み立て」だけを担当する。
 * 見た目は部品ごとのファイルにある：
 *   components/chat/   … チャット専用の部品（吹き出し・入力欄・ルームヘッダーなど）
 *   components/room/   … ルームに関する部品（消える日の表示・消滅画面）
 *   components/common/ … どの画面でも使う部品（アバター・下から出るシート）
 *   components/layout/ … ナビゲーション
 * 色・フォントは app/globals.css のデザイントークン（bg-paper / text-ink など）で決まる。
 *
 * レイアウト（Figma S-09 / S-09M 新配色）
 *  - スマホ：1列。参加者・共有スペースは人のアイコンから開くシートで表示
 *  - PC（lg = 1024px以上）：右側にサイドバーを常に表示
 * ============================================================ */

type Status = "loading" | "ok" | "gone" | "full" | "error";

const STORAGE_KEY = "ephemeral-chat:identity";
const POLL_MS = 2500; // 新着を取りに行く間隔

type ChatsProps = {
  roomId: string;
  /** 管理者として開いているか。ログイン（Supabase）と結合したら page.tsx から渡す */
  isAdmin?: boolean;
};

// roomId は app/rooms/[roomId]/page.tsx から受け取る
export function Chats({ roomId, isAdmin = false }: ChatsProps) {
  const router = useRouter();

  // --- 状態 ---
  const [me, setMe] = useState<Member | null>(null);
  const [ready, setReady] = useState(false); // sessionStorageの確認が終わったか

  const [messages, setMessages] = useState<Message[]>([]);
  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [memberCount, setMemberCount] = useState(0);
  const [members, setMembers] = useState<Member[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [now, setNow] = useState(() => Date.now()); // 「今日」の判定用。取得のたびに更新

  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false); // スマホの参加者シート
  const [notice, setNotice] = useState<string | null>(null); // 準備中などの一言

  const cursor = useRef(0); // どこまでメッセージを受け取ったか
  const fetching = useRef(false); // 取得の二重実行を防ぐ（同じメッセージが重複するため）

  // --- ブラウザに保存した一時ID＋ニックネームを読み込む ---
  // 仮の本人確認。本番は入室フォーム＋署名付きCookieに置き換える
  // sessionStorage はタブごとに別なので、同じブラウザの別タブ＝別の参加者として試せる
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) setMe(JSON.parse(saved));
    } catch {}
    setReady(true);
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
    if (!me) return;
    fetchNew();
    const t = setInterval(fetchNew, POLL_MS);
    return () => clearInterval(t);
  }, [fetchNew, me]);

  // 「準備中です」などの一言は2.5秒で消す
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 2500);
    return () => clearTimeout(t);
  }, [notice]);

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

  // --- 入室（仮）・退室 ---
  function join(nickname: string) {
    const identity = { guestId: crypto.randomUUID(), nickname };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
    setMe(identity);
  }

  function leave() {
    if (!window.confirm("このルームから退室しますか？")) return;
    sessionStorage.removeItem(STORAGE_KEY);
    router.push("/");
  }

  /* ---------- 画面の描画 ---------- */

  if (!ready) return null;
  if (!me) return <NicknameForm onSubmit={join} />;
  if (status === "gone" || status === "full") return <RoomEnded reason={status} />;

  // 自分を先頭に、サーバーから受け取った参加者を並べる
  const participants = [me, ...members.filter((p) => p.guestId !== me.guestId)];
  const membersLabel = formatMembers(memberCount, room?.maxMembers);
  const infoPanel = (
    <RoomInfoPanel
      participants={participants}
      myId={me.guestId}
      isAdmin={isAdmin}
      membersLabel={membersLabel}
    />
  );

  return (
    <div className="flex h-dvh flex-col bg-paper text-ink">
      <AppHeader
        logoHref={isAdmin ? "/dashboard" : undefined}
        actions={
          isAdmin ? (
            <Link
              href="/settings"
              aria-label="ユーザー設定"
              className="flex size-10 items-center justify-center rounded-full bg-card transition hover:bg-cloud-pale md:size-11"
            >
              <Settings className="size-5" />
            </Link>
          ) : (
            <button
              type="button"
              onClick={leave}
              className="flex items-center gap-1.5 text-sm font-medium transition hover:opacity-70"
            >
              <LogOut className="size-4" />
              退室
            </button>
          )
        }
      />

      <RoomHeader
        roomId={roomId}
        roomName={room?.name ?? "読み込み中…"}
        isAdmin={isAdmin}
        membersSummary={`${membersLabel}　${participants.map((p) => p.nickname).join("・")}`}
        expiresAt={room?.expiresAt}
        now={now}
        onOpenMembers={() => setMembersOpen(true)}
      />

      <div className="flex min-h-0 flex-1">
        <section className="flex min-w-0 flex-1 flex-col">
          {status === "error" && (
            <p className="bg-cloud-pale px-3 py-1.5 text-center text-xs">
              通信に失敗しました。再接続を試みています…
            </p>
          )}
          <MessageList messages={messages} myId={me.guestId} now={now} />
          <ChatComposer
            value={text}
            onChange={setText}
            onSend={send}
            sending={sending}
            notice={notice}
            // 消えるノート・ファイル共有（F-13 / F-14）は未実装。実装したらここから開く
            onOpenNote={() => setNotice("消えるノートは準備中です")}
            onShareFile={() => setNotice("ファイル共有は準備中です")}
          />
        </section>

        {/* PC：右サイドバー */}
        <aside className="hidden w-72 shrink-0 overflow-y-auto border-l border-line bg-card px-6 py-6 lg:block">
          {infoPanel}
        </aside>
      </div>

      {/* スマホ・タブレット：参加者・共有スペースのシート */}
      <BottomSheet
        open={membersOpen}
        onClose={() => setMembersOpen(false)}
        label="参加者と共有スペース"
        className="lg:hidden"
      >
        {infoPanel}
      </BottomSheet>
    </div>
  );
}
