import type { Message, RoomInfo } from "./types";

/**
 * Temporary message-only store until the Redis migration is implemented.
 * Room creation and authorization use Supabase, not this store.
 */
type DevRoom = {
  info: RoomInfo;
  startDate?: string;
  members: Map<string, string>;
  messages: Message[];
};

const g = globalThis as unknown as { __devRooms?: Map<string, DevRoom> };
const rooms = (g.__devRooms ??= new Map<string, DevRoom>());

export function createRoom(
  name: string,
  startDate: string,
  expiresAt: number,
): RoomInfo {
  const info: RoomInfo = {
    id: crypto.randomUUID(),
    name,
    maxMembers: null,
    startsAt: Date.parse(`${startDate}T00:00:00+09:00`),
    expiresAt,
  };
  rooms.set(info.id, { info, startDate, members: new Map(), messages: [] });
  return info;
}

export function getRoom(roomId: string): DevRoom | null {
  const room = rooms.get(roomId);
  if (!room || room.info.expiresAt <= Date.now()) return null;
  return room;
}

export function addMember(room: DevRoom, guestId: string, nickname: string) {
  if (room.members.has(guestId)) {
    room.members.set(guestId, nickname);
    return true;
  }
  if (room.info.maxMembers !== null && room.members.size >= room.info.maxMembers) {
    return false;
  }
  room.members.set(guestId, nickname);
  return true;
}

export function getMessageRoom(roomId: string, info: RoomInfo): DevRoom {
  let room = rooms.get(roomId);
  if (!room) {
    room = { info, members: new Map(), messages: [] };
    rooms.set(roomId, room);
  }
  room.info = info;
  return room;
}

export function pushMessage(
  room: DevRoom,
  senderId: string,
  nickname: string,
  body: string,
): Message {
  const message: Message = {
    id: crypto.randomUUID(),
    senderId,
    nickname,
    body,
    sentAt: Date.now(),
  };
  room.messages.push(message);
  if (room.messages.length > 500) room.messages.shift();
  return message;
}

export function listMessages(room: DevRoom, cursor: number) {
  return {
    messages: room.messages.slice(cursor),
    nextCursor: room.messages.length,
  };
}
