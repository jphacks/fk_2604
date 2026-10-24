import { NextResponse } from "next/server";
import {
  addMember,
  getRoom,
  listMessages,
  pushMessage,
} from "@/lib/dev-store";
import { getActor } from "@/lib/session";
import type { ApiErrorCode, MessagesResponse } from "@/lib/types";

/**
 * guestId / nickname は署名付きCookie（入室画面で発行）から getActor() で取得する。
 * クライアントから送られた値は使わない（なりすまし防止）。
 */

type Ctx = { params: Promise<{ roomId: string }> }; // Next.js 16: params は Promise

const MAX_BODY = 1000;

function fail(code: ApiErrorCode, status: number) {
  return NextResponse.json({ error: code }, { status });
}

export async function GET(req: Request, { params }: Ctx) {
  const { roomId } = await params;
  const url = new URL(req.url);
  const cursor = Math.max(0, Number(url.searchParams.get("cursor") ?? 0) || 0);

  const actor = await getActor(roomId);
  if (!actor) return fail("NOT_MEMBER", 401);

  const room = getRoom(roomId);
  if (!room) return fail("ROOM_GONE", 404);
  // 入室時に登録済みだが、開発サーバーの再読込でストアが消えた場合に備えて冪等に登録する
  if (!addMember(room, actor.guestId, actor.nickname)) return fail("ROOM_FULL", 403);

  const { messages, nextCursor } = listMessages(room, cursor);
  const body: MessagesResponse = {
    messages,
    nextCursor,
    memberCount: room.members.size,
    members: [...room.members].map(([id, name]) => ({ guestId: id, nickname: name })),
    room: room.info,
  };
  return NextResponse.json(body);
}

export async function POST(req: Request, { params }: Ctx) {
  const { roomId } = await params;
  const json = await req.json().catch(() => null);
  const text = (json?.body as string | undefined)?.trim();

  if (!text || text.length > MAX_BODY) return fail("BAD_REQUEST", 400);

  const actor = await getActor(roomId);
  if (!actor) return fail("NOT_MEMBER", 401);

  const room = getRoom(roomId);
  if (!room) return fail("ROOM_GONE", 404);
  if (!room.members.has(actor.guestId)) return fail("NOT_MEMBER", 403);

  const msg = pushMessage(room, actor.guestId, actor.nickname, text);
  return NextResponse.json(msg, { status: 201 });
}
