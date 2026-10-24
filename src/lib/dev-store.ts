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
  startDate?: string; // 利用期間の開始日 "YYYY-MM-DD"（期限延長で最大日数を判定するのに使う）
  members: Map<string, string>; // guestId -> nickname
  messages: Message[];
};

type DevInvite = { roomId: string; expiresAt: number };

const g = globalThis as unknown as {
  __devRooms?: Map<string, DevRoom>;
  __devInvites?: Map<string, DevInvite>;
};
const rooms = (g.__devRooms ??= new Map<string, DevRoom>());
const invites = (g.__devInvites ??= new Map<string, DevInvite>()); // inviteToken -> ルーム

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

/** ルーム作成（新規ルーム作成画面から呼ぶ）。人数上限なし */
export function createRoom(name: string, startDate: string, expiresAt: number): RoomInfo {
  const info: RoomInfo = {
    id: crypto.randomUUID(),
    name,
    maxMembers: null,
    expiresAt,
  };
  rooms.set(info.id, { info, startDate, members: new Map(), messages: [] });
  return info;
}

/** 招待トークンを発行する。expiresAt を過ぎると使えなくなる（古いURLからは入れない） */
export function issueInvite(roomId: string, expiresAt: number): string {
  const token = crypto.randomUUID().replaceAll("-", "");
  invites.set(token, { roomId, expiresAt });
  return token;
}

/** 招待トークンから roomId を引く。無効・期限切れなら null */
export function resolveInvite(token: string): string | null {
  const invite = invites.get(token);
  if (!invite) return null;
  if (invite.expiresAt <= Date.now()) {
    invites.delete(token);
    return null;
  }
  return invite.roomId;
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
