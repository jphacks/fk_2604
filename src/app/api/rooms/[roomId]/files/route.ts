import { NextResponse } from "next/server";
import { getRoom, pushMessage, saveFile, usedBytes } from "@/lib/dev-store";
import { MAX_FILE_BYTES, MAX_ROOM_BYTES } from "@/lib/file-limits";
import type { ApiErrorCode } from "@/lib/types";

/**
 * POST /api/rooms/{roomId}/files
 * ファイルを1つ受け取って保存し、チャットに「ファイルを共有しました」メッセージを流す。
 *
 * 送り方：FormData（multipart/form-data）
 *   file     … ファイル本体
 *   guestId  … 送った人の一時ID
 *   nickname … 送った人のニックネーム
 *
 * 仮実装：guestId / nickname はクライアントから受け取っている（messages API と同じ）。
 * 本番では署名付きCookieから取得する（なりすまし防止）。
 */

type Ctx = { params: Promise<{ roomId: string }> }; // Next.js 16: params は Promise

function fail(code: ApiErrorCode, status: number) {
  return NextResponse.json({ error: code }, { status });
}

/** ファイル名から危ない文字（パス区切り・改行など）を除き、長すぎる名前を切る */
function cleanFileName(name: string) {
  const cleaned = name.replace(/[\\/\u0000-\u001f\u007f]/g, "_").trim();
  return (cleaned || "file").slice(0, 120);
}

export async function POST(req: Request, { params }: Ctx) {
  const { roomId } = await params;

  // 中身を読む前に、ヘッダーの大きさで明らかに大きすぎるものを断る
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_FILE_BYTES + 64 * 1024) return fail("FILE_TOO_LARGE", 413);

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const guestId = form?.get("guestId");
  const nickname = form?.get("nickname");

  if (
    !(file instanceof File) ||
    typeof guestId !== "string" ||
    typeof nickname !== "string" ||
    file.size === 0
  ) {
    return fail("BAD_REQUEST", 400);
  }
  if (file.size > MAX_FILE_BYTES) return fail("FILE_TOO_LARGE", 413);

  const room = await getRoom(roomId);
  if (!room) return fail("ROOM_GONE", 404);
  if (!room.members.has(guestId)) return fail("NOT_MEMBER", 403);
  if ((await usedBytes(room)) + file.size > MAX_ROOM_BYTES) {
    return fail("ROOM_STORAGE_FULL", 413);
  }

  const meta = await saveFile(room, {
    name: cleanFileName(file.name),
    mimeType: file.type || "application/octet-stream",
    data: await file.arrayBuffer(),
    uploadedBy: guestId,
    nickname,
  });

  // チャットにも流す（本文は通知文、ファイル情報は file に入れる）
  const message = await pushMessage(
    room,
    guestId,
    nickname,
    `ファイルを共有しました：${meta.name}`,
    meta,
  );

  return NextResponse.json({ file: meta, message }, { status: 201 });
}
