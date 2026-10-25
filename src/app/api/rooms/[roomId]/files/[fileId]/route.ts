import { NextResponse } from "next/server";
import { getFile, getRoom } from "@/lib/dev-store";
import { isPreviewableImage } from "@/lib/file-limits";
import type { ApiErrorCode } from "@/lib/types";

/**
 * GET /api/rooms/{roomId}/files/{fileId}?guestId=...
 * 共有ファイルの中身を返す。ルームの参加者だけが取れる。
 *
 * ?download=1 を付けると、画像でも必ずダウンロードになる。
 *
 * 安全のための決まり：
 *  - 画像（png/jpeg/gif/webp）だけブラウザ内で表示（inline）してよい
 *  - それ以外（HTML・SVG・PDFなど）は必ずダウンロード扱いにする。
 *    HTMLをそのまま表示すると、仕込まれたスクリプトがこのサイトの権限で動いてしまうため
 *  - nosniff で、ブラウザが種類を勝手に推測して表示するのを防ぐ
 */

type Ctx = { params: Promise<{ roomId: string; fileId: string }> };

function fail(code: ApiErrorCode, status: number) {
  return NextResponse.json({ error: code }, { status });
}

export async function GET(req: Request, { params }: Ctx) {
  const { roomId, fileId } = await params;
  const url = new URL(req.url);
  const guestId = url.searchParams.get("guestId");
  const forceDownload = url.searchParams.get("download") === "1";

  if (!guestId) return fail("BAD_REQUEST", 400);

  const room = await getRoom(roomId);
  if (!room) return fail("ROOM_GONE", 404);
  if (!room.members.has(guestId)) return fail("NOT_MEMBER", 403);

  const stored = await getFile(room, fileId);
  if (!stored) return fail("FILE_NOT_FOUND", 404);

  const { meta, data } = stored;
  const inline = !forceDownload && isPreviewableImage(meta.mimeType);
  // 日本語のファイル名を正しく渡すため filename* を使う（RFC 6266）
  const encoded = encodeURIComponent(meta.name);

  return new NextResponse(data, {
    headers: {
      "Content-Type": inline ? meta.mimeType : "application/octet-stream",
      "Content-Length": String(meta.size),
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="file"; filename*=UTF-8''${encoded}`,
      "X-Content-Type-Options": "nosniff",
      // 消えるチャットなので、ブラウザや途中のサーバーに残さない
      "Cache-Control": "private, no-store",
    },
  });
}
