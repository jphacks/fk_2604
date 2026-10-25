import { NextResponse } from "next/server";
import { getRoomHeats } from "@/lib/dev-store";
import type { RoomHeatsResponse } from "@/lib/room-heat";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/rooms/heat
 * ダッシュボードを開いたまま、自分のルームの盛り上がり（雲の大きさ）を取り直すためのAPI。
 * - ログインしている管理者だけ（未ログイン・匿名ユーザーは 401）
 * - 自分が作成した、まだ消えていないルームの点数だけを返す（他人のルームは返さない）
 * - 返すのは点数と時刻だけ。会話の中身は返さない
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.is_anonymous) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const now = Date.now();
  const { data, error } = await supabase
    .from("rooms")
    .select("id")
    .eq("owner_id", user.id)
    .gt("expires_at", new Date(now).toISOString());
  if (error) {
    console.error("[api/rooms/heat] ルーム一覧の取得に失敗", error);
    return NextResponse.json({ error: "INTERNAL" }, { status: 500 });
  }

  // Redis の room:{roomId}:heat をまとめて読む
  const heats = await getRoomHeats(data.map((room) => room.id));

  const body: RoomHeatsResponse = { heats, now };
  return NextResponse.json(body);
}
