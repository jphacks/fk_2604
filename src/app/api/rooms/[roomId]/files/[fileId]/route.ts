import { NextResponse } from "next/server";
import { authorizeRoom, fail } from "@/lib/room-authorization";
import { downloadHeaders, validatedMime } from "@/lib/file-validation";
import { toSharedFile, type FileRow } from "@/lib/room-files";

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

export async function GET(req: Request, { params }: Ctx) {
  const { roomId, fileId } = await params;
  const url = new URL(req.url);
  const forceDownload = url.searchParams.get("download") === "1";

  const authorized = await authorizeRoom(roomId);
  if ("response" in authorized) return authorized.response;
  if (!/^[0-9a-f-]{36}$/i.test(fileId)) return fail("FILE_NOT_FOUND", 404);
  try {

  const { admin } = authorized;
    const stored = await admin.from("room_files").select("*").eq("room_id", roomId).eq("id", fileId).eq("status", "ready").maybeSingle();
    if (stored.error) throw stored.error;
    if (!stored.data) return fail("FILE_NOT_FOUND", 404);
    const meta = toSharedFile(stored.data as FileRow);
    const downloaded = await admin.storage.from("room-files").download((stored.data as FileRow).storage_path);
    if (downloaded.error) {
      if ("statusCode" in downloaded.error && String(downloaded.error.statusCode) === "404") return fail("FILE_NOT_FOUND", 404);
      throw downloaded.error;
    }
    const data = new Uint8Array(await downloaded.data.arrayBuffer());
    const rechecked = await authorizeRoom(roomId);
    if ("response" in rechecked) return rechecked.response;
    if (data.length !== meta.size) throw new Error("Stored size mismatch");
    meta.mimeType = validatedMime(meta.mimeType, data) ?? "application/octet-stream";
    // 日本語のファイル名を正しく渡すため filename* を使う（RFC 6266）

    return new NextResponse(data, {
      headers: downloadHeaders(meta, forceDownload),
    });
  } catch { return fail("SERVICE_UNAVAILABLE", 503); }
}
