import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { logout } from "../(auth)/login/logout-actions";

/* ============================================================
 * S-04 ダッシュボード（メイン / ルーム一覧・管理者）
 * 基本機能のみ（デザインは後で付ける）
 *  - ログインしていなければ /login へ
 *  - 自分が作成した有効なルームの一覧 → クリックでチャット（管理者用）へ
 *  - 各ルームの下に残り日数
 *  - ルーム追加（S-05）・ログアウト
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

/** 残り時間を「あと◯日」で返す。1日未満は「今日まで」 */
function formatRemainingDays(expiresAt: string, now: number) {
  const days = Math.floor((Date.parse(expiresAt) - now) / DAY_MS);
  return days >= 1 ? `あと${days}日` : "今日まで";
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.is_anonymous) redirect("/login");

  const { rooms, error, now } = await getMyRooms(supabase, user.id);

  return (
    <main className="flex flex-col gap-6 p-6">
      <header className="flex items-center gap-4">
        <h1 className="mr-auto text-xl font-semibold">メイン</h1>
        <span className="text-sm text-muted-foreground">{user.email}</span>
        {/* S-05 新規ルーム作成（src/app/(admin)/rooms/new）へ */}
        <Link href="/rooms/new" className={buttonVariants()}>ルーム作成</Link>
        <form action={logout}>
          <button type="submit" className="underline">ログアウト</button>
        </form>
      </header>

      {error ? (
        <p>ルームを読み込めませんでした。</p>
      ) : rooms.length === 0 ? (
        <p>まだルームがありません。</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {rooms.map((room) => (
            <li key={room.id}>
              {/* 管理者用のチャット画面（rooms/[roomId]/admin）へ */}
              <Link href={`/rooms/${room.id}/admin`}>{room.name}</Link>
              <p>{formatRemainingDays(room.expires_at, now)}</p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
