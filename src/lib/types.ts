/** 共有ファイルの情報（中身そのものは含まない。中身はダウンロードAPIから取る） */
export type SharedFile = {
  id: string;
  name: string; // 元のファイル名
  size: number; // バイト数
  mimeType: string; // 例：image/png, application/pdf
  uploadedBy: string; // guestId
  nickname: string; // 共有した人のニックネーム
  uploadedAt: number; // epoch ms
};

export type Message = {
  id: string;
  senderId: string;
  nickname: string;
  body: string;
  sentAt: number; // epoch ms
  /** ファイルを共有したときのメッセージだけに付く */
  file?: SharedFile;
};

export type RoomInfo = {
  id: string;
  name: string;
  maxMembers: number | null; // null = 上限なし
  expiresAt: number; // epoch ms
};

export type Member = { guestId: string; nickname: string };

export type MessagesResponse = {
  messages: Message[];
  nextCursor: number;
  memberCount: number;
  members: Member[];
  room: RoomInfo;
  /** ルームで共有中のファイル一覧（新しい順） */
  files: SharedFile[];
};

export type ApiErrorCode =
  | "NOT_MEMBER"
  | "ROOM_FULL"
  | "ROOM_GONE"
  | "BAD_REQUEST"
  | "FILE_TOO_LARGE"
  | "ROOM_STORAGE_FULL"
  | "FILE_NOT_FOUND";
