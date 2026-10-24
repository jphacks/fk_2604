import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

import type { Member } from "./types";

/**
 * ルームの参加証（署名付き・httpOnly の Cookie）。
 * - 入室画面（/join/[inviteToken]）でだけ発行する ＝ 招待URLを通らないと入れない
 * - ルームごとに別の Cookie にする（room_{roomId}）
 * - 署名があるので、guestId を書き換えてのなりすましはできない
 */

export type Actor = Member;

const DEV_SECRET = "dev-only-insecure-session-secret";

function secret() {
  const s = process.env.SESSION_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === "production") {
    throw new Error("環境変数 SESSION_SECRET が設定されていません");
  }
  return DEV_SECRET;
}

function cookieName(roomId: string) {
  return `room_${roomId}`;
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

/** 参加証を発行する。Server Action / Route Handler からのみ呼べる */
export async function setRoomSession(roomId: string, actor: Actor, expiresAt: number) {
  const payload = Buffer.from(
    JSON.stringify({ roomId, guestId: actor.guestId, nickname: actor.nickname }),
  ).toString("base64url");

  (await cookies()).set(cookieName(roomId), `${payload}.${sign(payload)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(expiresAt), // ルームが消える時刻に合わせて消える
  });
}

/** 参加証を確認する。未入室・改ざん・別ルームの Cookie なら null */
export async function getActor(roomId: string): Promise<Actor | null> {
  const value = (await cookies()).get(cookieName(roomId))?.value;
  if (!value) return null;

  const [payload, signature] = value.split(".");
  if (!payload || !signature) return null;

  const expected = Buffer.from(sign(payload));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return null;
  }

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (
      data.roomId !== roomId ||
      typeof data.guestId !== "string" ||
      typeof data.nickname !== "string"
    ) {
      return null;
    }
    return { guestId: data.guestId, nickname: data.nickname };
  } catch {
    return null;
  }
}
