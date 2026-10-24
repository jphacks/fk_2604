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

const g = globalThis as unknown as { __devRooms?: Map<string, DevRoom> };
const rooms = (g.__devRooms ??= new Map<string, DevRoom>());

export function getRoom(roomId: string): DevRoom | null {
  let room = rooms.get(roomId);
  // 動作確認用：未作成のIDは「人数上限なし・3時間」のルームとして自動作成
  if (!room) {
    room = {
      info: {
        id: roomId,
        name: "誕生日サプライズ会議",
        maxMembers: null,
        expiresAt: Date.now() + 3 * 60 * 60 * 1000,
      },
      members: new Map(),
      messages: [],
    };
    rooms.set(roomId, room);
  }
  if (room.info.expiresAt <= Date.now()) {
    rooms.delete(roomId);
    return null; // 期限切れ＝消滅
  }
  return room;
}

/** 入室。既に参加済みなら人数に数えない。上限があって満員なら false */
export function addMember(room: DevRoom, guestId: string, nickname: string) {
  if (room.members.has(guestId)) {
    room.members.set(guestId, nickname);
    return true;
  }
  const max = room.info.maxMembers;
  if (max !== null && room.members.size >= max) return false;
  room.members.set(guestId, nickname);
  return true;
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
