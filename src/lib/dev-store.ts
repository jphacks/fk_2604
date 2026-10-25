import { addHeat, type RoomHeat } from "./room-heat";
import type { Message, RoomInfo, SharedFile } from "./types";

/**
 * 開発用のメモリ上ストア（Redis結合までの仮置き）。
 * - サーバーを再起動すると消える（＝エフェメラルの動作確認にはちょうど良い）
 * - Next.jsの開発サーバーはファイル更新でモジュールが再読込されるため、
 *   globalThis に載せて状態を保つ
 * 後で lib/redis/ の実装に差し替える。関数名は変えないこと。
 *
 * ファイル共有について（要件定義 Q-11）
 * - いまはファイルの中身もメモリに置いている
 * - 本番では「中身は Supabase Storage、情報（名前・サイズなど）は Redis の room:{roomId}:files」
 *   に分ける。差し替えるのは saveFile / getFile の中身だけ
 * - ルームが消える（期限切れ）とファイルも一緒に消える
 */
type StoredFile = { meta: SharedFile; data: ArrayBuffer };

type DevRoom = {
  info: RoomInfo;
  members: Map<string, string>; // guestId -> nickname
  messages: Message[];
  files: Map<string, StoredFile>; // fileId -> 中身と情報
  /** 会話の盛り上がり（lib/room-heat.ts）。本番は Redis の room:{roomId}:heat */
  heat?: RoomHeat;
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
      files: new Map(),
    };
    rooms.set(roomId, room);
  }
  // 古い形（files がない）で残っている開発中のデータに備える
  room.files ??= new Map();
  if (room.info.expiresAt <= Date.now()) {
    rooms.delete(roomId); // メッセージもファイルもまとめて消える
    return null; // 期限切れ＝消滅
  }
  return room;
}

export function getExistingRoom(roomId: string): DevRoom | null {
  const room = rooms.get(roomId);
  if (!room) return null;
  room.files ??= new Map();
  if (room.info.expiresAt <= Date.now()) {
    rooms.delete(roomId);
    return null;
  }
  return room;
}

/**
 * DB（Supabase）のルーム情報で上書きする。ルーム名・期限をダッシュボードで作ったものと揃えるため、
 * app/rooms/[roomId]/page.tsx を開いたときに呼ぶ
 */
export function syncRoomInfo(info: RoomInfo) {
  const room = rooms.get(info.id);
  if (room) room.info = info;
  else {
    rooms.set(info.id, { info, members: new Map(), messages: [], files: new Map() });
  }
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
  file?: SharedFile,
): Message {
  const msg: Message = {
    id: crypto.randomUUID(),
    senderId,
    nickname,
    body,
    sentAt: Date.now(),
    ...(file ? { file } : {}),
  };
  room.messages.push(msg);
  if (room.messages.length > 500) room.messages.shift();
  // 盛り上がりの点数を +1（ファイル共有のメッセージも1件として数える）
  room.heat = addHeat(room.heat, msg.sentAt);
  return msg;
}

/**
 * ルームの盛り上がりの点数（ダッシュボードの雲の大きさに使う）。
 * getRoom() は無いルームを自動作成してしまうので、ここでは rooms.get() で見るだけにする。
 * ルームが無い・期限切れ・まだ点数が無いときは null
 */
export function getRoomHeat(roomId: string): RoomHeat | null {
  const room = rooms.get(roomId);
  if (!room || room.info.expiresAt <= Date.now()) return null;
  return room.heat ?? null;
}

/** cursor（配列の添字）以降のメッセージを返す */
export function listMessages(room: DevRoom, cursor: number) {
  return {
    messages: room.messages.slice(cursor),
    nextCursor: room.messages.length,
  };
}

/* ---------- ファイル共有 ---------- */

/** ルームで使っている合計バイト数 */
export function usedBytes(room: DevRoom) {
  let total = 0;
  for (const f of room.files.values()) total += f.meta.size;
  return total;
}

/** ファイルを保存して、その情報を返す */
export function saveFile(
  room: DevRoom,
  input: {
    name: string;
    mimeType: string;
    data: ArrayBuffer;
    uploadedBy: string;
    nickname: string;
  },
): SharedFile {
  const meta: SharedFile = {
    id: crypto.randomUUID(),
    name: input.name,
    size: input.data.byteLength,
    mimeType: input.mimeType,
    uploadedBy: input.uploadedBy,
    nickname: input.nickname,
    uploadedAt: Date.now(),
  };
  room.files.set(meta.id, { meta, data: input.data });
  return meta;
}

export function getFile(room: DevRoom, fileId: string): StoredFile | null {
  return room.files.get(fileId) ?? null;
}

/** 共有中のファイル一覧（新しい順） */
export function listFiles(room: DevRoom): SharedFile[] {
  return [...room.files.values()]
    .map((f) => f.meta)
    .sort((a, b) => b.uploadedAt - a.uploadedAt);
}
