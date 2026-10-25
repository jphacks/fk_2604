import type { SupabaseClient } from "@supabase/supabase-js";

export type FileRow = {
  id: string; room_id: string; storage_path: string; name: string;
  size: number; mime_type: string; uploaded_by: string; nickname: string;
  uploaded_at: string; expires_at?: string;
};

export function toSharedFile(row: FileRow) {
  return {
    id: row.id, name: row.name, size: Number(row.size), mimeType: row.mime_type,
    uploadedBy: row.uploaded_by, nickname: row.nickname, uploadedAt: Date.parse(row.uploaded_at),
  };
}

export function fileMessage(row: FileRow) {
  return {
    id: row.id, senderId: row.uploaded_by, nickname: row.nickname,
    body: `ファイルを共有しました：${row.name}`, sentAt: Date.parse(row.uploaded_at), file: toSharedFile(row),
  };
}

// One atomic Redis operation: append + TTL + deduplication + existing heat format.
// The dedup set shares the room TTL, and polling refreshes it when the room is extended.
export const FILE_NOTIFICATION_LUA = `
local deadline = tonumber(ARGV[2])
local clock = redis.call('TIME')
if deadline <= tonumber(clock[1]) then return -1 end
redis.call('EXPIREAT', KEYS[3], deadline)
if redis.call('SISMEMBER', KEYS[3], ARGV[1]) == 1 then return 0 end
-- A room can be extended after a marker expired but while the list survives.
-- Recover deduplication from the deterministic message id before appending.
for _, raw in ipairs(redis.call('LRANGE', KEYS[1], 0, -1)) do
  local ok, value = pcall(cjson.decode, raw)
  if ok and type(value) == 'table' and value.id == ARGV[1] then
    redis.call('SADD', KEYS[3], ARGV[1])
    redis.call('EXPIREAT', KEYS[3], deadline)
    return 0
  end
end
local heat = {score = 0, updatedAt = tonumber(ARGV[4])}
local previous = redis.call('GET', KEYS[2])
if previous then
  local ok, value = pcall(cjson.decode, previous)
  if ok and type(value) == 'table' and tonumber(value.score) and tonumber(value.updatedAt) then
    heat.score = tonumber(value.score) * math.pow(0.5, math.max(0, heat.updatedAt - tonumber(value.updatedAt)) / 1800000)
  end
end
heat.score = heat.score + 1
redis.call('RPUSH', KEYS[1], ARGV[3])
redis.call('EXPIREAT', KEYS[1], deadline)
redis.call('SET', KEYS[2], cjson.encode(heat), 'EXAT', deadline)
redis.call('SADD', KEYS[3], ARGV[1])
redis.call('EXPIREAT', KEYS[3], deadline)
return 1`;

export async function notifyFile(row: FileRow, redis: { url: string; token: string }) {
  const prefix = `chat:room:${row.room_id}`;
  const response = await fetch(redis.url, {
    method: "POST", headers: { Authorization: `Bearer ${redis.token}`, "Content-Type": "application/json" },
    body: JSON.stringify(["EVAL", FILE_NOTIFICATION_LUA, "3", `${prefix}:messages`, `${prefix}:heat`, `${prefix}:file-notifications`,
      row.id, String(Math.floor(Date.parse(row.expires_at!) / 1000)), JSON.stringify(fileMessage(row)), String(Date.now())]),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error("Redis file notification failed");
  const result = await response.json() as { result?: number; error?: string };
  if (result.error || (result.result !== 0 && result.result !== 1)) throw new Error("Redis file notification not committed");
}

export async function flushFileNotifications(admin: SupabaseClient, redis: { url: string; token: string }, roomId?: string) {
  const { data, error } = await admin.rpc("pending_room_file_notifications", { p_room_id: roomId ?? null });
  if (error) throw error;
  let failed = 0;
  const rows = (data ?? []) as FileRow[];
  for (let start = 0; start < rows.length; start += 5) {
    await Promise.all(rows.slice(start, start + 5).map(async (row) => {
      try {
        await notifyFile(row, redis);
        const updated = await admin.from("room_files").update({ notified_at: new Date().toISOString() })
          .eq("id", row.id).eq("status", "ready");
        if (updated.error) throw updated.error;
      } catch { failed++; }
    }));
  }
  return { notified: (data ?? []).length - failed, failed };
}

export async function cleanupRoomFiles(admin: SupabaseClient) {
  const { data, error } = await admin.rpc("claim_room_file_cleanup");
  if (error) throw error;
  let failed = 0;
  const rows = (data ?? []) as (FileRow & { cleanup_token: string })[];
  for (let start = 0; start < rows.length; start += 5) {
    await Promise.all(rows.slice(start, start + 5).map(async (row) => {
      try {
        const removed = await admin.storage.from("room-files").remove([row.storage_path]);
        if (removed.error) throw removed.error;
        const finished = await admin.rpc("finish_room_file_cleanup", { p_id: row.id, p_token: row.cleanup_token });
        if (finished.error) throw finished.error;
      } catch { failed++; } // Keep the row and retry after its lease expires.
    }));
  }
  return { deleted: (data ?? []).length - failed, failed };
}
