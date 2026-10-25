import type { Message } from "@/lib/types";
import { getRedis } from "@/lib/redis";

const keyFor = (roomId: string) => `chat:room:${roomId}:messages`;

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

  await getRedis()
    .multi()
    .rpush(keyFor(room.id), message)
    .expireat(keyFor(room.id), expiresAt)
    .exec();

  return message;
}

export async function syncMessageTtl(room: MessageRoom): Promise<void> {
  const expiresAt = expirySeconds(room);
  await getRedis().expireat(keyFor(room.id), expiresAt);
}
