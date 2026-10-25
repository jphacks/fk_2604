import { NextResponse } from "next/server";
import { listRoomFiles, flushRoomFiles } from "@/lib/room-files";
import { authorizeRoom as authorize, fail } from "@/lib/room-authorization";
import {
  listMessages,
  pushMessage,
  syncMessageTtl,
} from "@/lib/redis-messages";
import type { MessagesResponse } from "@/lib/types";

type Ctx = { params: Promise<{ roomId: string }> };

const MAX_BODY = 1000;

export async function GET(req: Request, { params }: Ctx) {
  const { roomId } = await params;
  const authorized = await authorize(roomId);
  if ("response" in authorized) return authorized.response;

  const url = new URL(req.url);
  const parsedCursor = Number(url.searchParams.get("cursor") ?? 0);
  const cursor = Number.isSafeInteger(parsedCursor) && parsedCursor >= 0 ? parsedCursor : 0;

  try {
    await syncMessageTtl(authorized.messageRoom);
    await flushRoomFiles(roomId);
    const { messages, nextCursor } = await listMessages(authorized.messageRoom, cursor);
    const body: MessagesResponse = {
      messages,
      nextCursor,
      // 管理者は room_members に入らないので、ゲストにも参加しているとわかるよう先頭に足す
      // （ゲストは管理者のプロフィールを読めないため、名前はメッセージと同じ「管理者」）
      memberCount: authorized.members.length + 1,
      members: [
        { guestId: authorized.room.owner_id, nickname: "管理者" },
        ...authorized.members.map((member) => ({
          guestId: member.user_id,
          nickname: member.nickname,
        })),
      ],
      room: {
        id: authorized.room.id,
        name: authorized.room.name,
        maxMembers: authorized.room.max_members,
        expiresAt: Date.parse(authorized.room.expires_at),
      },
      files: await listRoomFiles(roomId),
    };
    return NextResponse.json(body, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return fail("SERVICE_UNAVAILABLE", 503);
  }
}

export async function POST(req: Request, { params }: Ctx) {
  const { roomId } = await params;
  const authorized = await authorize(roomId);
  if ("response" in authorized) return authorized.response;

  const json = await req.json().catch(() => null);
  const text = typeof json?.body === "string" ? json.body.trim() : "";
  if (!text || text.length > MAX_BODY) return fail("BAD_REQUEST", 400);

  try {
    const message = await pushMessage(
      authorized.messageRoom,
      authorized.user.id,
      authorized.nickname,
      text,
    );
    return NextResponse.json(message, { status: 201 });
  } catch {
    return fail("SERVICE_UNAVAILABLE", 503);
  }
}
