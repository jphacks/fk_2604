import { createHash, createHmac } from "node:crypto";
import { headers } from "next/headers";

import type { createClient } from "@/lib/supabase/server";
import { nextMidnightJst, todayJst } from "./room-period";

/**
 * 招待URL（/join/[inviteToken]）。毎日 0:00 JST に新しいURLへ切り替わる。
 * - トークンは「ルームID＋日本時間の日付」を秘密鍵で署名して作る。
 *   同じ日なら何度計算しても同じURLになるので、DBにトークンそのものを保存せずに表示し直せる
 * - DB（room_invites）にはハッシュ値だけを保存する。新しい日のトークンを登録すると、
 *   issue_room_invite が前日までのトークンを取り消すので、古いURLからは入れなくなる
 * - 定期実行は不要。その日に初めて ensureTodayInvite が呼ばれたときに登録される
 */

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

const DEV_SECRET = "dev-only-insecure-invite-secret";

function secret() {
  const s = process.env.INVITE_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === "production") {
    throw new Error("環境変数 INVITE_SECRET が設定されていません");
  }
  return DEV_SECRET;
}

/** 入室画面（join/[inviteToken]）と同じ方式でハッシュ化する */
export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function inviteTokenFor(roomId: string, date = todayJst()): string {
  return createHmac("sha256", secret()).update(`${roomId}:${date}`).digest("base64url");
}

async function findInvite(supabase: SupabaseServerClient, tokenHash: string) {
  const { data, error } = await supabase
    .from("room_invites")
    .select("revoked_at, expires_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();
  if (error) throw new Error("招待URLを確認できませんでした");
  return data;
}

function isUsable(invite: { revoked_at: string | null; expires_at: string }) {
  return invite.revoked_at === null && Date.parse(invite.expires_at) > Date.now();
}

/**
 * 今日の招待トークンを返す。まだDBに登録されていなければ登録する。
 * ルームの作成者としてログインしている Supabase クライアントで呼ぶこと（RLS で作成者のみ許可）
 */
export async function ensureTodayInvite(
  supabase: SupabaseServerClient,
  roomId: string,
  roomExpiresAt: number,
): Promise<string> {
  const token = inviteTokenFor(roomId);
  const tokenHash = hashInviteToken(token);

  const existing = await findInvite(supabase, tokenHash);
  if (existing) {
    if (isUsable(existing)) return token;
    throw new Error("今日の招待URLは無効になっています");
  }

  // 次の 0:00 まで有効。ルームがそれより先に消えるならその時刻まで
  const expiresAt = new Date(Math.min(nextMidnightJst(), roomExpiresAt)).toISOString();
  const { error } = await supabase.rpc("issue_room_invite", {
    p_room_id: roomId,
    p_token_hash: tokenHash,
    p_expires_at: expiresAt,
  });
  if (error) {
    // 同時に開いた別の画面が先に登録した場合は、そちらを使う
    const raced = await findInvite(supabase, tokenHash);
    if (raced && isUsable(raced)) return token;
    throw new Error("招待URLを発行できませんでした");
  }
  return token;
}

/** リクエスト元のオリジンから招待URLを組み立てる */
export async function inviteUrlFor(token: string): Promise<string> {
  const h = await headers();
  const origin = h.get("origin") ?? `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  return `${origin}/join/${token}`;
}
