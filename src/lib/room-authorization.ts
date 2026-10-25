import "server-only";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMessageRoom } from "@/lib/redis-messages";
import type { ApiErrorCode } from "@/lib/types";

export function fail(code: ApiErrorCode, status: number) {
  return NextResponse.json({ error: code }, { status, headers: { "Cache-Control": "private, no-store" } });
}

export async function authorizeRoom(roomId: string) {
  try {
    const client = await createClient();
    const { data: { user }, error } = await client.auth.getUser();
    if (error || !user) return { response: fail("NOT_MEMBER", 401) } as const;
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(roomId)) {
      return { response: fail("ROOM_GONE", 404) } as const;
    }
    // Read privileged metadata only after verifying the session. This distinguishes
    // a real non-member (403) from a missing room hidden by RLS (404).
    const admin = createAdminClient();
    const { data: room, error: roomError } = await admin.from("rooms")
      .select("id, name, owner_id, max_members, starts_at, expires_at").eq("id", roomId).maybeSingle();
    if (roomError) throw roomError;
    if (!room) return { response: fail("ROOM_GONE", 404) } as const;
    const { data: members, error: membersError } = await admin.from("room_members")
      .select("user_id, nickname").eq("room_id", roomId).is("kicked_at", null);
    if (membersError) throw membersError;
    const membership = members?.find((member) => member.user_id === user.id);
    const isOwner = room.owner_id === user.id;
    if (!isOwner && !membership) return { response: fail("NOT_MEMBER", 403) } as const;
    const start = Date.parse(room.starts_at), end = Date.parse(room.expires_at), now = Date.now();
    if (!Number.isFinite(start) || !Number.isFinite(end) || start > now || end <= now) {
      return { response: fail("ROOM_GONE", 404) } as const;
    }
    return {
      admin, user, room, nickname: isOwner ? "管理者" : membership!.nickname,
      members: (members ?? []).filter((member) => member.user_id !== room.owner_id),
      messageRoom: getMessageRoom(roomId, room.expires_at),
    } as const;
  } catch {
    return { response: fail("SERVICE_UNAVAILABLE", 503) } as const;
  }
}
