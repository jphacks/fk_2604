"use server";

import { redirect } from "next/navigation";

import { addMember, getRoom, resolveInvite } from "@/lib/dev-store";
import { getActor, setRoomSession } from "@/lib/session";
import { NICKNAME_MAX_LENGTH } from "./constants";

export type JoinRoomState = {
  errors?: {
    nickname?: string;
  };
  // 入力エラー時にフォームへ戻す値
  fields?: {
    nickname: string;
  };
  formError?: string;
};

export async function joinRoom(
  _prevState: JoinRoomState,
  formData: FormData,
): Promise<JoinRoomState> {
  const inviteToken = String(formData.get("inviteToken") ?? "");
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

  // TODO: Redis接続後、dev-store を lib/redis/ の実装に差し替える
  const roomId = resolveInvite(inviteToken);
  const room = roomId ? getRoom(roomId) : null;
  if (!roomId || !room) {
    return {
      fields: { nickname },
      formError:
        "この招待URLは期限切れか、ルームが消滅しています。招待した人に新しいURLをもらってください",
    };
  }

  // 同じブラウザで入り直した場合は同じ参加者として扱う（自分のメッセージが右側のまま）
  const current = await getActor(roomId);
  const guestId = current?.guestId ?? crypto.randomUUID();
  if (!addMember(room, guestId, nickname)) {
    return { fields: { nickname }, formError: "このルームは満員です" };
  }

  await setRoomSession(roomId, { guestId, nickname }, room.info.expiresAt);
  redirect(`/rooms/${roomId}`);
}
