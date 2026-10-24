import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getMessageRoom, listMessages, pushMessage } from "@/lib/dev-store";
import type { ApiErrorCode, MessagesResponse, RoomInfo } from "@/lib/types";

type Ctx = { params: Promise<{ roomId: string }> };
const MAX_BODY = 1000;

function fail(code: ApiErrorCode, status: number) {
  return NextResponse.json({ error: code }, { status });
}

async function getAuthorizedRoom(roomId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: fail("NOT_MEMBER", 401) };

  const { data: allowed, error: allowedError } = await supabase.rpc(
    "is_active_room_member",
    { p_room_id: roomId, p_user_id: user.id },
  );
  if (allowedError || !allowed) return { error: fail("NOT_MEMBER", 403) };

  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .select("id, name, max_members, starts_at, expires_at")
    .eq("id", roomId)
    .maybeSingle();
  if (roomError || !room) return { error: fail("ROOM_GONE", 404) };

  const { data: members, error: membersError } = await supabase
    .from("room_members")
    .select("user_id, nickname")
    .eq("room_id", roomId)
    .is("kicked_at", null);
  if (membersError) return { error: fail("NOT_MEMBER", 403) };

  const roomInfo: RoomInfo = {
    id: room.id,
    name: room.name,
    maxMembers: room.max_members,
    startsAt: new Date(room.starts_at).getTime(),
    expiresAt: new Date(room.expires_at).getTime(),
  };
  const currentMember = members.find((member) => member.user_id === user.id);
  if (!currentMember) return { error: fail("NOT_MEMBER", 403) };
  return { supabase, user, room, roomInfo, members, currentMember };
}

export async function GET(_request: Request, { params }: Ctx) {
  const { roomId } = await params;
  const result = await getAuthorizedRoom(roomId);
  if ("error" in result) return result.error;
  const cursor = Math.max(
    0,
    Number(new URL(_request.url).searchParams.get("cursor") ?? 0) || 0,
  );
  const messageRoom = getMessageRoom(roomId, result.roomInfo);
  const { messages, nextCursor } = listMessages(messageRoom, cursor);
  const body: MessagesResponse = {
    messages,
    nextCursor,
    memberCount: result.members.length,
    members: result.members.map((member) => ({
      guestId: member.user_id,
      nickname: member.nickname,
    })),
    room: result.roomInfo,
  };
  return NextResponse.json(body);
}

export async function POST(request: Request, { params }: Ctx) {
  const { roomId } = await params;
  const result = await getAuthorizedRoom(roomId);
  if ("error" in result) return result.error;
  const json = await request.json().catch(() => null);
  const text = typeof json?.body === "string" ? json.body.trim() : "";
  if (!text || text.length > MAX_BODY) return fail("BAD_REQUEST", 400);

  const messageRoom = getMessageRoom(roomId, result.roomInfo);
  const message = pushMessage(
    messageRoom,
    result.user.id,
    result.currentMember.nickname,
    text,
  );
  return NextResponse.json(message, { status: 201 });
}
