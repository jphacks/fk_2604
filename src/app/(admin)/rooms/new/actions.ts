"use server";

import { createHash, randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
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
    return { message: "ルームを作成できませんでした", fields: { name } };
  }

  const inviteToken = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(inviteToken).digest("hex");
  const { error: inviteError } = await supabase.rpc("issue_room_invite", {
    p_room_id: room.id,
    p_token_hash: tokenHash,
    p_expires_at: expiresAt,
  });
  if (inviteError) {
    await supabase.from("rooms").delete().eq("id", room.id);
    return { message: "招待URLを発行できませんでした", fields: { name } };
  }

  const requestHeaders = await headers();
  const origin =
    requestHeaders.get("origin") ??
    `${requestHeaders.get("x-forwarded-proto") ?? "https"}://${requestHeaders.get("host")}`;
  return {
    created: { roomId: room.id, inviteToken, inviteUrl: `${origin}/join/${inviteToken}` },
  };
}
