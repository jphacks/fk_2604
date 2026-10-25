import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { formatRemainingDays } from "@/components/common/format";
import { DashboardActions } from "@/components/dashboard/dashboard-actions";
import {
  RoomCloudEmpty,
  RoomCloudError,
  RoomCloudList,
  type RoomCloudItem,
} from "@/components/dashboard/room-cloud-list";
import { PageShell } from "@/components/layout/page-shell";
import { createClient } from "@/lib/supabase/server";
import { logout } from "../(auth)/login/logout-actions";

/* ============================================================
 * S-04 ダッシュボード（メイン / ルーム一覧・管理者）
 * このファイルは機能だけ。見た目は components/dashboard/ にある
 *  - ログインしていなければ /login へ
 *  - 自分が作成した有効なルームを雲で表示 → クリックでチャットへ
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

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.is_anonymous) redirect("/login");

  const { rooms, error, now } = await getMyRooms(supabase, user.id);
  const items: RoomCloudItem[] = rooms.map((room) => {
    const expiresAt = Date.parse(room.expires_at);
    return {
      id: room.id,
      name: room.name,
      href: `/rooms/${room.id}`,
      remainingLabel: formatRemainingDays(expiresAt, now),
      endsToday: expiresAt - now < DAY_MS,
    };
  });

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
          <RoomCloudList rooms={items} />
        )}
      </main>
    </PageShell>
  );
}
