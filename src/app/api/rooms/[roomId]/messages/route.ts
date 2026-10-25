import { NextResponse } from "next/server";
import { getExistingRoom, listFiles } from "@/lib/dev-store";
import {
  getMessageRoom,
  listMessages,
  pushMessage,
  syncMessageTtl,
} from "@/lib/redis-messages";
import { createClient } from "@/lib/supabase/server";
import type { ApiErrorCode, MessagesResponse } from "@/lib/types";

type Ctx = { params: Promise<{ roomId: string }> };

const MAX_BODY = 1000;

function fail(code: ApiErrorCode, status: number) {
  return NextResponse.json({ error: code }, { status });
}

async function authorize(roomId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { response: fail("NOT_MEMBER", 401) } as const;

  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .select("id, name, owner_id, max_members, starts_at, expires_at")
    .eq("id", roomId)
    .maybeSingle();
  if (roomError) return { response: fail("SERVICE_UNAVAILABLE", 503) } as const;
  if (!room) return { response: fail("ROOM_GONE", 404) } as const;

  const now = Date.now();
  const startsAt = Date.parse(room.starts_at);
  const expiresAt = Date.parse(room.expires_at);
  if (!Number.isFinite(startsAt) || !Number.isFinite(expiresAt) || startsAt > now || expiresAt <= now) {
    return { response: fail("ROOM_GONE", 404) } as const;
  }

  const { data: membership, error: membershipError } = await supabase
    .from("room_members")
    .select("user_id, nickname")
    .eq("room_id", roomId)
    .eq("user_id", user.id)
    .is("kicked_at", null)
    .maybeSingle();
  if (membershipError) return { response: fail("SERVICE_UNAVAILABLE", 503) } as const;

  const isOwner = room.owner_id === user.id;
  if (!isOwner && !membership) return { response: fail("NOT_MEMBER", 403) } as const;

  const { data: members, error: membersError } = await supabase
    .from("room_members")
    .select("user_id, nickname")
    .eq("room_id", roomId)
    .is("kicked_at", null);
  if (membersError) return { response: fail("SERVICE_UNAVAILABLE", 503) } as const;

  return {
    user,
    room,
    nickname: isOwner ? "管理者" : membership?.nickname ?? "",
    members: members ?? [],
    messageRoom: getMessageRoom(roomId, room.expires_at),
  } as const;
}

export async function GET(req: Request, { params }: Ctx) {
  const { roomId } = await params;
  const authorized = await authorize(roomId);
  if ("response" in authorized) return authorized.response;

  const url = new URL(req.url);
  const parsedCursor = Number(url.searchParams.get("cursor") ?? 0);
  const cursor = Number.isSafeInteger(parsedCursor) && parsedCursor >= 0 ? parsedCursor : 0;

  try {
    await syncMessageTtl(authorized.messageRoom);
    const { messages, nextCursor } = await listMessages(authorized.messageRoom, cursor);
    const fileRoom = getExistingRoom(roomId);
    const body: MessagesResponse = {
      messages,
      nextCursor,
      memberCount: authorized.members.length,
      members: authorized.members.map((member) => ({
        guestId: member.user_id,
        nickname: member.nickname,
      })),
      room: {
        id: authorized.room.id,
        name: authorized.room.name,
        maxMembers: authorized.room.max_members,
        expiresAt: Date.parse(authorized.room.expires_at),
      },
      files: fileRoom ? listFiles(fileRoom) : [],
    };
    return NextResponse.json(body);
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
