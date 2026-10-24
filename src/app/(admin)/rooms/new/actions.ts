"use server";

import { headers } from "next/headers";

import { createRoom as createDevRoom } from "@/lib/dev-store";
import { endOfDayJst, validateRoomPeriod } from "@/lib/room-period";
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
  // - 招待トークンを発行（毎日0:00 JSTで更新。古いトークンでは入室不可）
  //   入室画面は Supabase の room_invites でトークンを照合するため、
  //   ここで issue_room_invite を呼ぶまでは「閉じる」の先の入室画面で弾かれる
  createDevRoom(name, startDate, endOfDayJst(endDate));
  const inviteToken = crypto.randomUUID().replaceAll("-", "");

  const h = await headers();
  const origin = h.get("origin") ?? `https://${h.get("host")}`;

  return {
    created: {
      inviteToken,
      inviteUrl: `${origin}/join/${inviteToken}`,
    },
  };
}
