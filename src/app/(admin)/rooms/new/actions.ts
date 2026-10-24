"use server";

import { headers } from "next/headers";

import { createRoom as createDevRoom, issueInvite } from "@/lib/dev-store";
import { endOfDayJst, nextMidnightJst, validateRoomPeriod } from "@/lib/room-period";
import { ROOM_NAME_MAX_LENGTH } from "./constants";

export type CreateRoomState = {
  errors?: {
    name?: string;
    period?: string;
  };
  // 入力エラー時にフォームへ戻す値
  fields?: {
    name: string;
  };
  created?: {
    inviteToken: string;
    inviteUrl: string;
  };
};

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
  if (errors.name || errors.period) {
    return { errors, fields: { name } };
  }

  // TODO: Supabase / Redis 接続後に差し替える
  // - ログイン中の管理者IDを owner として保存
  // - 0:00 を過ぎたら新しいトークンを発行する（ルーム設定画面を開いたときなど）
  const room = createDevRoom(name, startDate, endOfDayJst(endDate));
  // 招待URLは次の 0:00 JST まで有効（ルームがそれより先に消えるならその時刻まで）
  const inviteToken = issueInvite(room.id, Math.min(nextMidnightJst(), room.expiresAt));

  const h = await headers();
  const origin = h.get("origin") ?? `https://${h.get("host")}`;

  return {
    created: {
      inviteToken,
      inviteUrl: `${origin}/join/${inviteToken}`,
    },
  };
}
