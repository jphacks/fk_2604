import type { Message } from "@/lib/types";
import { getRedis } from "@/lib/redis";
import { addHeat, type RoomHeat } from "@/lib/room-heat";

const keyFor = (roomId: string) => `chat:room:${roomId}:messages`;
/** 会話の盛り上がり（lib/room-heat.ts）。ダッシュボードの雲の大きさ・色に使う */
const heatKeyFor = (roomId: string) => `chat:room:${roomId}:heat`;

export type MessageRoom = {
  id: string;
  expiresAt: number;
};

export function getMessageRoom(roomId: string, expiresAt: string): MessageRoom {
  return { id: roomId, expiresAt: Date.parse(expiresAt) };
}

function expirySeconds(room: MessageRoom): number {
  const seconds = Math.floor(room.expiresAt / 1000);
  if (!Number.isFinite(seconds) || seconds <= Math.floor(Date.now() / 1000)) {
    throw new Error("Cannot store messages for an expired room");
  }
  return seconds;
}

export async function listMessages(room: MessageRoom, cursor: number) {
  const messages = await getRedis().lrange<Message>(
    keyFor(room.id),
    cursor,
    -1,
  );
  return {
    messages,
    nextCursor: cursor + messages.length,
  };
}

export async function pushMessage(
  room: MessageRoom,
  senderId: string,
  nickname: string,
  body: string,
  file?: Message["file"],
): Promise<Message> {
  const message: Message = {
    id: crypto.randomUUID(),
    senderId,
    nickname,
    body,
    sentAt: Date.now(),
    ...(file ? { file } : {}),
  };
  const expiresAt = expirySeconds(room);
  // 盛り上がりの点数を +1（ファイル共有のメッセージも1件として数える）
  const heat = addHeat(await getRedis().get<RoomHeat>(heatKeyFor(room.id)), message.sentAt);

  await getRedis()
    .multi()
    .rpush(keyFor(room.id), message)
    .expireat(keyFor(room.id), expiresAt)
    .set(heatKeyFor(room.id), heat, { exat: expiresAt })
    .exec();

  return message;
}

export async function syncMessageTtl(room: MessageRoom): Promise<void> {
  const expiresAt = expirySeconds(room);
  await getRedis()
    .multi()
    .expireat(keyFor(room.id), expiresAt)
    .expireat(heatKeyFor(room.id), expiresAt)
    .exec();
}

/**
 * 複数ルームの盛り上がりの点数をまとめて取る（ダッシュボード用。1回の通信で済む）。
 * ルームが無い・期限切れ・まだ点数が無いときは null
 */
export async function getRoomHeats(roomIds: string[]): Promise<Record<string, RoomHeat | null>> {
  const heats: Record<string, RoomHeat | null> = {};
  if (roomIds.length === 0) return heats;
  const values = await getRedis().mget<(RoomHeat | null)[]>(...roomIds.map(heatKeyFor));
  roomIds.forEach((id, i) => {
    heats[id] = values[i] ?? null;
  });
  return heats;
}
