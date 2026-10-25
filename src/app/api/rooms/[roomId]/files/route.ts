import { NextResponse } from "next/server";
import { authorizeRoom, fail } from "@/lib/room-authorization";
import { MAX_FILE_BYTES } from "@/lib/file-limits";
import { cleanFileName, validatedMime } from "@/lib/file-validation";
import { fileMessage, flushRoomFiles, toSharedFile, type FileRow } from "@/lib/room-files";

/**
 * POST /api/rooms/{roomId}/files
 * ファイルを1つ受け取って保存し、チャットに「ファイルを共有しました」メッセージを流す。
 *
 * 送り方：FormData（multipart/form-data）
 *   file     … ファイル本体
 *   guestId / nickname … 既存画面との互換性のため受け付けるが使用しない
 *
 * Supabase Auth Cookieで本人確認し、DB上の所有者・参加者情報で認可する。
 */

type Ctx = { params: Promise<{ roomId: string }> }; // Next.js 16: params は Promise

export async function POST(req: Request, { params }: Ctx) {
  const { roomId } = await params;
  const authorized = await authorizeRoom(roomId);
  if ("response" in authorized) return authorized.response;
  try {
    // Reject excessive bodies even when Content-Length is absent or forged.
    const declared = Number(req.headers.get("content-length") ?? 0);
    if (declared > MAX_FILE_BYTES + 64 * 1024) return fail("FILE_TOO_LARGE", 413);

    const limit = MAX_FILE_BYTES + 64 * 1024;
    const reader = req.body?.getReader();
    if (!reader) return fail("BAD_REQUEST", 400);
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit) { await reader.cancel(); return fail("FILE_TOO_LARGE", 413); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    const form = await new Response(bytes, { headers: { "Content-Type": req.headers.get("content-type") ?? "" } }).formData().catch(() => null);
    const file = form?.get("file");

    if (
      !(file instanceof File) ||
      file.size === 0
    ) {
      return fail("BAD_REQUEST", 400);
    }
    if (file.size > MAX_FILE_BYTES) return fail("FILE_TOO_LARGE", 413);

    const content = new Uint8Array(await file.arrayBuffer());
    const mime = validatedMime(file.type, content);
    if (!mime) return fail("BAD_REQUEST", 400);
    const fileId = crypto.randomUUID();
    const { admin } = authorized;
    const reserved = await admin.rpc("reserve_room_file", {
      p_room_id: roomId, p_id: fileId, p_user_id: authorized.user.id,
      p_name: cleanFileName(file.name), p_mime_type: mime, p_size: file.size,
    });
    if (reserved.error) {
      if (reserved.error.message.includes("ROOM_STORAGE_FULL")) return fail("ROOM_STORAGE_FULL", 413);
      if (reserved.error.message.includes("NOT_MEMBER")) return fail("NOT_MEMBER", 403);
      if (reserved.error.message.includes("ROOM_GONE")) return fail("ROOM_GONE", 404);
      throw reserved.error;
    }
    const row = reserved.data as FileRow;
    const uploaded = await admin.storage.from("room-files").upload(row.storage_path, content, { contentType: mime, upsert: false });
    if (uploaded.error) throw uploaded.error;
    const finalized = await admin.rpc("complete_room_file", { p_id: fileId, p_user_id: authorized.user.id });
    if (finalized.error) throw finalized.error;
    const ready = finalized.data as FileRow;
    const meta = toSharedFile(ready);

    // チャットにも流す（本文は通知文、ファイル情報は file に入れる）
    // A committed DB outbox survives process/Redis failures. Return success once
    // stored; polling and the scheduled worker retry notification idempotently.
    try { await flushRoomFiles(roomId); } catch { /* durable retry */ }
    const message = fileMessage(ready);

    return NextResponse.json({ file: meta, message }, { status: 201 });
  } catch {
    // Leave the reservation for scheduled cleanup, including ambiguous failures.
    return fail("SERVICE_UNAVAILABLE", 503);
  }
}
