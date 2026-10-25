"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ensureTodayInvite, inviteUrlFor } from "@/lib/invite";
import { createClient } from "@/lib/supabase/server";
import { endOfDayJst, validateRoomPeriod } from "@/lib/room-period";
import { ROOM_NAME_MAX_LENGTH } from "./constants";

export type CreateRoomState = {
  errors?: { name?: string; period?: string };
  fields?: { name: string };
  created?: { roomId: string; inviteToken: string; inviteUrl: string };
  message?: string;
};

function toIsoStart(date: string) {
  return `${date}T00:00:00+09:00`;
}

export async function createRoom(
  _prevState: CreateRoomState,
  formData: FormData,
): Promise<CreateRoomState> {
  const name = String(formData.get("name") ?? "").trim();
  const startDate = String(formData.get("startDate") ?? "");
  const endDate = String(formData.get("endDate") ?? "");
  const errors: CreateRoomState["errors"] = {
    name: !name
      ? "ルーム名を入力してください"
      : name.length > ROOM_NAME_MAX_LENGTH
        ? `ルーム名は${ROOM_NAME_MAX_LENGTH}文字以内で入力してください`
        : undefined,
    period: validateRoomPeriod(startDate, endDate),
  };
  if (errors.name || errors.period) return { errors, fields: { name } };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.is_anonymous) redirect("/login");

  const startsAt = toIsoStart(startDate);
  const expiresAt = new Date(endOfDayJst(endDate)).toISOString();
  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .insert({
      owner_id: user.id,
      name,
      starts_at: startsAt,
      expires_at: expiresAt,
      max_members: null,
    })
    .select("id")
    .single();
  if (roomError || !room) {
    console.error("[createRoom] ルームの作成に失敗", roomError);
    return { message: "ルームを作成できませんでした", fields: { name } };
  }

  // 今日の招待URL（次の0:00まで有効）。設定画面と同じ方式なので、同じ日なら同じURLになる
  let inviteToken: string;
  try {
    inviteToken = await ensureTodayInvite(supabase, room.id, Date.parse(expiresAt));
  } catch {
    await supabase.from("rooms").delete().eq("id", room.id);
    return { message: "招待URLを発行できませんでした", fields: { name } };
  }

  // ダッシュボードのルーム一覧に新しいルームを出すため、キャッシュを破棄する
  revalidatePath("/dashboard");

  return {
    created: { roomId: room.id, inviteToken, inviteUrl: await inviteUrlFor(inviteToken) },
  };
}
