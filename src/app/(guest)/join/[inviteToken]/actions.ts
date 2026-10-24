"use server";

import { createHash } from "node:crypto";
import { redirect } from "next/navigation";
import { toAuthErrorMessage } from "@/lib/supabase/auth-errors";
import { createClient } from "@/lib/supabase/server";
import { NICKNAME_MAX_LENGTH } from "./constants";
import type { RoomPreview } from "@/types/room";

function isRoomPreview(value: unknown): value is RoomPreview {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { id?: unknown }).id === "string" &&
    typeof (value as { name?: unknown }).name === "string"
  );
}

export type JoinRoomState = {
  errors?: {
    nickname?: string;
  };
  // 入力エラー時にフォームへ戻す値
  fields?: {
    nickname: string;
  };
  message?: string;
};

export async function joinRoom(
  _prevState: JoinRoomState,
  formData: FormData,
): Promise<JoinRoomState> {
  const nickname = String(formData.get("nickname") ?? "").trim();

  const errors: JoinRoomState["errors"] = {};
  if (!nickname) {
    errors.nickname = "ニックネームを入力してください";
  } else if (nickname.length > NICKNAME_MAX_LENGTH) {
    errors.nickname = `ニックネームは${NICKNAME_MAX_LENGTH}文字以内で入力してください`;
  }
  if (errors.nickname) {
    return { errors, fields: { nickname } };
  }

  const inviteToken = String(formData.get("inviteToken") ?? "");
  if (!inviteToken || inviteToken.length > 256) {
    return { message: "招待URLが無効です" };
  }

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    const { error } = await supabase.auth.signInAnonymously();
    if (error) return { message: toAuthErrorMessage(error), fields: { nickname } };
  }
  const { data: currentUser, error: userError } = await supabase.auth.getUser();
  if (userError || !currentUser.user) {
    return { message: "ゲスト認証を確認できませんでした", fields: { nickname } };
  }

  const tokenHash = createHash("sha256").update(inviteToken).digest("hex");
  const { data: preview, error: previewError } = await supabase
    .rpc("get_room_by_invite", { p_token_hash: tokenHash })
    .maybeSingle();
  if (previewError || !isRoomPreview(preview)) {
    return { message: "招待URLが無効、または期限切れです", fields: { nickname } };
  }
  const { error: joinError } = await supabase.rpc("join_room", {
    p_room_id: preview.id,
    p_token_hash: tokenHash,
    p_nickname: nickname,
  });
  if (joinError) {
    const message = joinError.message;
    if (message.includes("room is full")) return { message: "このルームは満員です", fields: { nickname } };
    if (message.includes("member is not allowed")) return { message: "このルームへの参加権限がありません", fields: { nickname } };
    return { message: "ルームに参加できませんでした", fields: { nickname } };
  }
  redirect(`/room/${preview.id}`);
}
