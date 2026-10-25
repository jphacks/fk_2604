import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { formatRemainingDays } from "@/components/common/format";
import { DashboardActions } from "@/components/dashboard/dashboard-actions";
import {
  RoomCloudEmpty,
  RoomCloudError,
} from "@/components/dashboard/room-cloud-list";
import { PageShell } from "@/components/layout/page-shell";
import { getRoomHeat } from "@/lib/dev-store";
import type { RoomHeatsResponse } from "@/lib/room-heat";
import { createClient } from "@/lib/supabase/server";
import { logout } from "../(auth)/login/logout-actions";
import { LiveRoomClouds } from "./_components/live-room-clouds";

/* ============================================================
 * S-04 ダッシュボード（メイン / ルーム一覧・管理者）
 * このファイルは機能だけ。見た目は components/dashboard/ にある
 *  - ログインしていなければ /login へ
 *  - 自分が作成した有効なルームを雲で表示 → クリックでチャットへ
 *  - 雲の大きさ＝会話の盛り上がり（lib/room-heat.ts）。開いたまま30秒ごとに取り直す
 *  - 各雲の下に残り日数
 *  - ルーム作成（S-05）・ログアウト
 * ============================================================ */

export const metadata: Metadata = {
  title: "メイン",
};

const DAY_MS = 24 * 60 * 60 * 1000;

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** 自分が作成した、まだ消えていないルームを残りが少ない順に取得 */
async function getMyRooms(supabase: Supabase, userId: string) {
  const now = Date.now();
  const { data, error } = await supabase
    .from("rooms")
    .select("id, name, expires_at")
    .eq("owner_id", userId)
    .gt("expires_at", new Date(now).toISOString())
    .order("expires_at", { ascending: true });
  if (error) console.error("[dashboard] ルーム一覧の取得に失敗", error);
  return { rooms: data ?? [], error, now };
}

/** 最初に表示する盛り上がりの点数。以降はブラウザ側（useRoomHeat）で取り直す */
function getInitialHeats(roomIds: string[]): RoomHeatsResponse {
  // Date.now() はコンポーネント本体で呼ぶと react-hooks/purity に引っかかるので、ここで呼ぶ
  const now = Date.now();
  const heats: RoomHeatsResponse["heats"] = {};
  // TODO: Redis 接続後は room:{roomId}:heat を読む
  for (const id of roomIds) heats[id] = getRoomHeat(id);
  return { heats, now };
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.is_anonymous) redirect("/login");

  const { rooms, error, now } = await getMyRooms(supabase, user.id);
  const items = rooms.map((room) => {
    const expiresAt = Date.parse(room.expires_at);
    return {
      id: room.id,
      name: room.name,
      href: `/rooms/${room.id}/admin`, // 管理者用チャット
      remainingLabel: formatRemainingDays(expiresAt, now),
      endsToday: expiresAt - now < DAY_MS,
    };
  });
  const initialHeats = getInitialHeats(rooms.map((room) => room.id));

  return (
    <PageShell
      logoHref="/dashboard"
      actions={<DashboardActions email={user.email} logoutAction={logout} />}
    >
      <main className="flex-1 px-5 pt-6 pb-16 md:px-12 md:pt-10">
        <h1 className="sr-only">メイン</h1>
        {error ? (
          <RoomCloudError />
        ) : items.length === 0 ? (
          <RoomCloudEmpty />
        ) : (
          <LiveRoomClouds rooms={items} initialHeats={initialHeats} />
        )}
      </main>
    </PageShell>
  );
}
