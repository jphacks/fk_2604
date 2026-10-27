"use server";

import { createHash } from "node:crypto";
import { redirect } from "next/navigation";
import { toAuthErrorMessage } from "@/lib/supabase/auth-errors";
import { createClient } from "@/lib/supabase/server";
import { NICKNAME_MAX_LENGTH } from "./constants";
import type { RoomPreview } from "@/types/room";

export type JoinRoomState = {
  errors?: { nickname?: string };
  fields?: { nickname: string };
  message?: string;
};

function isRoomPreview(value: unknown): value is RoomPreview {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { id?: unknown }).id === "string" &&
    typeof (value as { name?: unknown }).name === "string"
  );
}

export async function joinRoom(
  _prevState: JoinRoomState,
  formData: FormData,
): Promise<JoinRoomState> {
  const nickname = String(formData.get("nickname") ?? "").trim();
  const inviteToken = String(formData.get("inviteToken") ?? "");
  const errors: JoinRoomState["errors"] = {};
  if (!nickname) errors.nickname = "ニックネームを入力してください";
  else if (nickname.length > NICKNAME_MAX_LENGTH) {
    errors.nickname = `ニックネームは${NICKNAME_MAX_LENGTH}文字以内で入力してください`;
  }
  if (errors.nickname) return { errors, fields: { nickname } };
  if (!inviteToken || inviteToken.length > 256) {
    return { message: "招待URLが無効です", fields: { nickname } };
  }

  const supabase = await createClient();
  const { data: existing } = await supabase.auth.getUser();
  if (!existing.user) {
    const { error } = await supabase.auth.signInAnonymously();
    if (error) return { message: toAuthErrorMessage(error), fields: { nickname } };
  }
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return { message: "ゲスト認証を確認できませんでした", fields: { nickname } };
  }

  const tokenHash = createHash("sha256").update(inviteToken).digest("hex");
  const { data: preview, error: previewError } = await supabase
    .rpc("get_room_by_invite", { p_token_hash: tokenHash })
    .maybeSingle();
  if (previewError || !isRoomPreview(preview)) {
    return { message: "招待URLが無効、または期限切れです", fields: { nickname } };
  }

  // 作成者（ログイン済みの管理者）は room_members に登録せず、そのままチャットへ。
  // 入室画面を開いた後にログインした場合など、画面側の判定をすり抜けたときの備え
  if (!userData.user.is_anonymous) {
    const { data: isOwner } = await supabase.rpc("is_room_owner", { p_room_id: preview.id });
    if (isOwner === true) redirect(`/rooms/${preview.id}`);
  }

  const { error: joinError } = await supabase.rpc("join_room", {
    p_room_id: preview.id,
    p_token_hash: tokenHash,
    p_nickname: nickname,
  });
  if (joinError) {
    console.error("[joinRoom] ルームへの参加に失敗", joinError);
    if (joinError.message.includes("room is full")) {
      return { message: "このルームは満員です", fields: { nickname } };
    }
    if (joinError.message.includes("member is not allowed")) {
      return { message: "このルームへの参加権限がありません", fields: { nickname } };
    }
    return { message: "ルームに参加できませんでした", fields: { nickname } };
  }
  redirect(`/rooms/${preview.id}`);
}
