import { redis } from "./redis";
import { addHeat, type RoomHeat } from "./room-heat";
import type { Message, RoomInfo, SharedFile } from "./types";

/**
 * チャットの保存先（Upstash Redis）。サーバーを再起動しても会話は残る。
 * 接続先は .env.local の UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN（lib/redis.ts）。
 * 関数名は変えないこと（メモリ版だったころの名前のまま。Redis にしたので await が必要）。
 *
 * Redis のキー（どれもルームの期限 expiresAt に自動で消える＝エフェメラル）
 *   room:{roomId}:info     … ルーム情報（JSON）
 *   room:{roomId}:members  … 参加者（ハッシュ：guestId -> ニックネーム）
 *   room:{roomId}:messages … メッセージ（リスト：古い順に JSON）
 *   room:{roomId}:files    … 共有ファイルの情報（ハッシュ：fileId -> JSON）
 *   room:{roomId}:heat     … 会話の盛り上がり（JSON。lib/room-heat.ts）
 *
 * ファイル共有について（要件定義 Q-11）
 * - ファイルの「情報」は Redis に置くが、「中身」はまだメモリに置いている
 *   （最大10MBあり、Redis に入れるには大きすぎるため）。サーバーを再起動すると中身だけ消える
 * - 本番では中身を Supabase Storage に置く。差し替えるのは saveFile / getFile の中身だけ
 */
type StoredFile = { meta: SharedFile; data: ArrayBuffer };

/** 読み込んだルーム。info と members だけ持ち、メッセージなどは必要なときに Redis から読む */
type DevRoom = {
  info: RoomInfo;
  members: Map<string, string>; // guestId -> nickname
};

const MAX_MESSAGES = 500;

const key = {
  info: (roomId: string) => `room:${roomId}:info`,
  members: (roomId: string) => `room:${roomId}:members`,
  messages: (roomId: string) => `room:${roomId}:messages`,
  files: (roomId: string) => `room:${roomId}:files`,
  heat: (roomId: string) => `room:${roomId}:heat`,
};

// ファイルの中身（メモリ上）。開発サーバーのファイル更新で消えないよう globalThis に載せる
const g = globalThis as unknown as { __devFileData?: Map<string, ArrayBuffer> };
const fileData = (g.__devFileData ??= new Map<string, ArrayBuffer>());

/** ルームのキーに「期限が来たら消える」設定を付ける */
function expireAt(
  tx: ReturnType<ReturnType<typeof redis>["multi"]>,
  roomId: string,
  info: RoomInfo,
  keys: (keyof typeof key)[],
) {
  for (const k of keys) tx.pexpireat(key[k](roomId), info.expiresAt);
}

/** ルームを読み込む。無い・期限切れなら null */
export async function getRoom(roomId: string): Promise<DevRoom | null> {
  const [rawInfo, rawMembers] = await redis()
    .pipeline()
    .get<string>(key.info(roomId))
    .hgetall<Record<string, string>>(key.members(roomId))
    .exec<[string | null, Record<string, string> | null]>();
  if (!rawInfo) return null; // 期限切れなら Redis が消している
  const info: RoomInfo = JSON.parse(rawInfo);
  if (info.expiresAt <= Date.now()) return null;
  return { info, members: new Map(Object.entries(rawMembers ?? {})) };
}

/**
 * DB（Supabase）のルーム情報を Redis に書く。ルーム名・期限をダッシュボードで作ったものと揃えるため、
 * app/rooms/[roomId]/page.tsx を開いたときに呼ぶ。期限が延びたときは、ほかのキーの期限も延ばす
 */
export async function syncRoomInfo(info: RoomInfo) {
  if (info.expiresAt <= Date.now()) return;
  const tx = redis().multi();
  tx.set(key.info(info.id), JSON.stringify(info), { pxat: info.expiresAt });
  expireAt(tx, info.id, info, ["members", "messages", "files", "heat"]);
  await tx.exec();
}

/** 入室。既に参加済みなら人数に数えない。上限があって満員なら false */
export async function addMember(room: DevRoom, guestId: string, nickname: string) {
  const isNew = !room.members.has(guestId);
  const max = room.info.maxMembers;
  if (isNew && max !== null && room.members.size >= max) return false;
  // ニックネームが変わっていなければ書き込まない（2.5秒ごとのポーリングで毎回呼ばれるため）
  if (room.members.get(guestId) === nickname) return true;
  room.members.set(guestId, nickname);
  const tx = redis().multi();
  tx.hset(key.members(room.info.id), { [guestId]: nickname });
  expireAt(tx, room.info.id, room.info, ["members"]);
  await tx.exec();
  return true;
}

export async function pushMessage(
  room: DevRoom,
  senderId: string,
  nickname: string,
  body: string,
  file?: SharedFile,
): Promise<Message> {
  const roomId = room.info.id;
  const msg: Message = {
    id: crypto.randomUUID(),
    senderId,
    nickname,
    body,
    sentAt: Date.now(),
    ...(file ? { file } : {}),
  };
  // 盛り上がりの点数を +1（ファイル共有のメッセージも1件として数える）
  const heat = addHeat(await getRoomHeat(roomId), msg.sentAt);

  const tx = redis().multi();
  tx.rpush(key.messages(roomId), JSON.stringify(msg));
  tx.ltrim(key.messages(roomId), -MAX_MESSAGES, -1); // 古いものから捨てて500件までにする
  tx.set(key.heat(roomId), JSON.stringify(heat));
  expireAt(tx, roomId, room.info, ["messages", "heat"]);
  await tx.exec();
  return msg;
}

/** cursor（配列の添字）以降のメッセージを返す */
export async function listMessages(room: DevRoom, cursor: number) {
  const raw = await redis().lrange<string>(key.messages(room.info.id), cursor, -1);
  const messages: Message[] = raw.map((m) => JSON.parse(m));
  return { messages, nextCursor: cursor + messages.length };
}

/**
 * ルームの盛り上がりの点数（ダッシュボードの雲の大きさに使う）。
 * ルームが無い・期限切れ・まだ点数が無いときは null
 */
export async function getRoomHeat(roomId: string): Promise<RoomHeat | null> {
  const raw = await redis().get<string>(key.heat(roomId));
  return raw ? JSON.parse(raw) : null; // 期限切れなら Redis が消している
}

/** 複数ルームの点数をまとめて取る（ダッシュボード用。1回の通信で済む） */
export async function getRoomHeats(roomIds: string[]): Promise<Record<string, RoomHeat | null>> {
  const heats: Record<string, RoomHeat | null> = {};
  if (roomIds.length === 0) return heats;
  const raw = await redis().mget<(string | null)[]>(...roomIds.map(key.heat));
  roomIds.forEach((id, i) => {
    heats[id] = raw[i] ? JSON.parse(raw[i]) : null;
  });
  return heats;
}

/* ---------- ファイル共有 ---------- */

async function fileMetas(roomId: string): Promise<SharedFile[]> {
  const raw = await redis().hvals(key.files(roomId));
  return (raw as string[]).map((f) => JSON.parse(f));
}

/** ルームで使っている合計バイト数 */
export async function usedBytes(room: DevRoom) {
  let total = 0;
  for (const f of await fileMetas(room.info.id)) total += f.size;
  return total;
}

/** ファイルを保存して、その情報を返す */
export async function saveFile(
  room: DevRoom,
  input: {
    name: string;
    mimeType: string;
    data: ArrayBuffer;
    uploadedBy: string;
    nickname: string;
  },
): Promise<SharedFile> {
  const meta: SharedFile = {
    id: crypto.randomUUID(),
    name: input.name,
    size: input.data.byteLength,
    mimeType: input.mimeType,
    uploadedBy: input.uploadedBy,
    nickname: input.nickname,
    uploadedAt: Date.now(),
  };
  fileData.set(meta.id, input.data);
  const tx = redis().multi();
  tx.hset(key.files(room.info.id), { [meta.id]: JSON.stringify(meta) });
  expireAt(tx, room.info.id, room.info, ["files"]);
  await tx.exec();
  return meta;
}

/** ファイルの情報と中身。中身がメモリに無い（再起動で消えた）ときも null */
export async function getFile(room: DevRoom, fileId: string): Promise<StoredFile | null> {
  const raw = await redis().hget<string>(key.files(room.info.id), fileId);
  const data = fileData.get(fileId);
  if (!raw || !data) return null;
  return { meta: JSON.parse(raw), data };
}

/** 共有中のファイル一覧（新しい順） */
export async function listFiles(room: DevRoom): Promise<SharedFile[]> {
  return (await fileMetas(room.info.id)).sort((a, b) => b.uploadedAt - a.uploadedAt);
}
