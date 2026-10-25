import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DashboardActions } from "@/components/dashboard/dashboard-actions";
import {
  CreateRoomLink,
  RoomCloudEmpty,
  RoomCloudError,
  RoomCloudLegend,
} from "@/components/dashboard/room-cloud-list";
import { PageShell } from "@/components/layout/page-shell";
import { getDisplayName } from "@/lib/display-name";
import { getRoomHeats } from "@/lib/redis-messages";
import type { RoomHeatsResponse } from "@/lib/room-heat";
import { createClient } from "@/lib/supabase/server";
import { logout } from "../(auth)/login/logout-actions";
import { LiveRoomClouds, type DashboardRoom } from "./_components/live-room-clouds";

/* ============================================================
 * S-04 ダッシュボード（メイン / ルーム一覧・管理者）
 * このファイルは機能だけ。見た目は components/dashboard/ にある
 *  - ログインしていなければ /login へ
 *  - 自分が作成した有効なルームを雲で表示 → クリックでチャットへ、歯車でルーム設定へ
 *  - 雲の大きさ＝会話の盛り上がり（lib/room-heat.ts）。開いたまま30秒ごとに取り直す
 *  - 雲の濃さ＝初期の生存時間に対する残りの割合（減るほど淡く）。残り時間・参加人数を雲の中に出す
 *  - ルーム作成（S-05）・ログアウト
 * ============================================================ */

export const metadata: Metadata = {
  title: "メイン",
};

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** 自分が作成した、まだ消えていないルームを残りが少ない順に取得 */
async function getMyRooms(supabase: Supabase, userId: string) {
  const now = Date.now();
  const { data, error } = await supabase
    .from("rooms")
    .select("id, name, max_members, starts_at, expires_at")
    .eq("owner_id", userId)
    .gt("expires_at", new Date(now).toISOString())
    .order("expires_at", { ascending: true });
  if (error) console.error("[dashboard] ルーム一覧の取得に失敗", error);
  return { rooms: data ?? [], error, now };
}

/** ルームごとの参加人数。チャット画面と同じく、ゲスト（管理者を除く）＋管理者1人で数える */
async function getMemberCounts(supabase: Supabase, roomIds: string[], ownerId: string) {
  const counts: Record<string, number> = {};
  if (roomIds.length === 0) return counts;
  const { data, error } = await supabase
    .from("room_members")
    .select("room_id, user_id")
    .in("room_id", roomIds)
    .is("kicked_at", null);
  if (error) console.error("[dashboard] 参加人数の取得に失敗", error);
  for (const member of data ?? []) {
    if (member.user_id === ownerId) continue;
    counts[member.room_id] = (counts[member.room_id] ?? 0) + 1;
  }
  return counts;
}

/** 最初に表示する盛り上がりの点数。以降はブラウザ側（useRoomHeat）で取り直す */
async function getInitialHeats(roomIds: string[]): Promise<RoomHeatsResponse> {
  // Date.now() はコンポーネント本体で呼ぶと react-hooks/purity に引っかかるので、ここで呼ぶ
  const now = Date.now();
  try {
    return { heats: await getRoomHeats(roomIds), now };
  } catch (error) {
    // Redis に繋がらなくても一覧は出す（雲はすべて小さく表示される）
    console.error("[dashboard] 盛り上がりの取得に失敗", error);
    return { heats: {}, now };
  }
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.is_anonymous) redirect("/login");

  const { rooms, error } = await getMyRooms(supabase, user.id);
  const roomIds = rooms.map((room) => room.id);
  const [memberCounts, displayName, initialHeats] = await Promise.all([
    getMemberCounts(supabase, roomIds, user.id),
    getDisplayName(supabase, user.id, user.email),
    getInitialHeats(roomIds),
  ]);
  const items: DashboardRoom[] = rooms.map((room) => ({
    id: room.id,
    name: room.name,
    href: `/rooms/${room.id}`, // 管理者もゲストと同じチャット画面（設定ボタンが出る）
    settingsHref: `/rooms/${room.id}/settings`,
    startsAt: Date.parse(room.starts_at),
    expiresAt: Date.parse(room.expires_at),
    memberCount: (memberCounts[room.id] ?? 0) + 1,
    maxMembers: room.max_members,
  }));

  return (
    <PageShell
      logoHref="/dashboard"
      actions={<DashboardActions name={displayName} logoutAction={logout} />}
      footer
    >
      <main className="mx-auto w-full max-w-6xl flex-1 px-5 pt-8 pb-16 md:px-12 md:pt-12">
        <div className="mb-8 flex flex-col gap-5 md:mb-10 md:flex-row md:items-end md:justify-between">
          <div className="flex flex-col gap-2">
            <p className="text-xs font-bold tracking-wide text-cloud-deep md:text-sm">あなたのチャンネル</p>
            <h1 className="text-2xl font-bold break-all md:text-[32px]">こんにちは、{displayName}さん。</h1>
            {!error && items.length > 0 && (
              <p className="text-sm text-ink-muted">いま集まれる雲が、{items.length}つ浮かんでいます。</p>
            )}
          </div>
          {!error && items.length > 0 && <CreateRoomLink className="self-start md:self-auto" />}
        </div>

        {error ? (
          <RoomCloudError />
        ) : items.length === 0 ? (
          <RoomCloudEmpty />
        ) : (
          <>
            <LiveRoomClouds rooms={items} initialHeats={initialHeats} />
            <RoomCloudLegend />
          </>
        )}
      </main>
    </PageShell>
  );
}
