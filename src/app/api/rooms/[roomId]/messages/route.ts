import { NextResponse } from "next/server";
import {
  addMember,
  getRoom,
  listFiles,
  listMessages,
  pushMessage,
} from "@/lib/dev-store";
import type { ApiErrorCode, MessagesResponse } from "@/lib/types";

/**
 * 仮実装：guestId / nickname をクライアントから受け取る。
 * 本番では署名付きCookieから getActor() で取得する（なりすまし防止）。
 */

type Ctx = { params: Promise<{ roomId: string }> }; // Next.js 16: params は Promise

const MAX_BODY = 1000;

function fail(code: ApiErrorCode, status: number) {
  return NextResponse.json({ error: code }, { status });
}

export async function GET(req: Request, { params }: Ctx) {
  const { roomId } = await params;
  const url = new URL(req.url);
  const guestId = url.searchParams.get("guestId");
  const nickname = url.searchParams.get("nickname");
  const cursor = Math.max(0, Number(url.searchParams.get("cursor") ?? 0) || 0);

  if (!guestId || !nickname) return fail("BAD_REQUEST", 400);

  const room = getRoom(roomId);
  if (!room) return fail("ROOM_GONE", 404);
  if (!addMember(room, guestId, nickname)) return fail("ROOM_FULL", 403);

  const { messages, nextCursor } = listMessages(room, cursor);
  const body: MessagesResponse = {
    messages,
    nextCursor,
    memberCount: room.members.size,
    members: [...room.members].map(([id, name]) => ({ guestId: id, nickname: name })),
    room: room.info,
    files: listFiles(room),
  };
  return NextResponse.json(body);
}

export async function POST(req: Request, { params }: Ctx) {
  const { roomId } = await params;
  const json = await req.json().catch(() => null);
  const guestId = json?.guestId as string | undefined;
  const nickname = json?.nickname as string | undefined;
  const text = (json?.body as string | undefined)?.trim();

  if (!guestId || !nickname || !text || text.length > MAX_BODY) {
    return fail("BAD_REQUEST", 400);
  }

  const room = getRoom(roomId);
  if (!room) return fail("ROOM_GONE", 404);
  if (!room.members.has(guestId)) return fail("NOT_MEMBER", 403);

  const msg = pushMessage(room, guestId, nickname, text);
  return NextResponse.json(msg, { status: 201 });
}
