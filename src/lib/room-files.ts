import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { flushFileNotifications, toSharedFile, type FileRow } from "../../supabase/functions/_shared/file-jobs";

export { fileMessage, toSharedFile } from "../../supabase/functions/_shared/file-jobs";
export type { FileRow } from "../../supabase/functions/_shared/file-jobs";

export async function listRoomFiles(roomId: string) {
  const admin = createAdminClient();
  const files: ReturnType<typeof toSharedFile>[] = [];
  // The Data API caps a single response. Walk stable pages rather than silently
  // losing older files once a room has more than the default 1,000 rows.
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await admin.from("room_files").select("*")
      .eq("room_id", roomId).eq("status", "ready")
      .order("uploaded_at", { ascending: false }).order("id", { ascending: false })
      .range(offset, offset + 499);
    if (error) throw error;
    const rows = (data ?? []) as FileRow[];
    files.push(...rows.map(toSharedFile));
    if (rows.length < 500) return files;
  }
}

export async function flushRoomFiles(roomId: string) {
  const url = process.env.UPSTASH_REDIS_REST_URL, token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error("Redis configuration is missing");
  return flushFileNotifications(createAdminClient(), { url, token }, roomId);
}
