import type { Message, RoomInfo } from "./types";

/**
 * 開発用のメモリ上ストア（Redis結合までの仮置き）。
 * - サーバーを再起動すると消える（＝エフェメラルの動作確認にはちょうど良い）
 * - Next.jsの開発サーバーはファイル更新でモジュールが再読込されるため、
 *   globalThis に載せて状態を保つ
 * 後で lib/redis/ の実装に差し替える。関数名は変えないこと。
 */
type DevRoom = {
  info: RoomInfo;
  members: Map<string, string>; // guestId -> nickname
  messages: Message[];
};

const g = globalThis as unknown as { __devMessageRooms?: Map<string, DevRoom> };
const rooms = (g.__devMessageRooms ??= new Map<string, DevRoom>());

export function getMessageRoom(roomId: string, info: RoomInfo): DevRoom {
  let room = rooms.get(roomId);
  if (!room) {
    room = {
      info,
      members: new Map(),
      messages: [],
    };
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
  const msg: Message = {
    id: crypto.randomUUID(),
    senderId,
    nickname,
    body,
    sentAt: Date.now(),
  };
  room.messages.push(msg);
  if (room.messages.length > 500) room.messages.shift();
  return msg;
}

/** cursor（配列の添字）以降のメッセージを返す */
export function listMessages(room: DevRoom, cursor: number) {
  return {
    messages: room.messages.slice(cursor),
    nextCursor: room.messages.length,
  };
}
