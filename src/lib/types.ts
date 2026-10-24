export type Message = {
  id: string;
  senderId: string;
  nickname: string;
  body: string;
  sentAt: number; // epoch ms
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
};

export type ApiErrorCode =
  | "NOT_MEMBER"
  | "ROOM_FULL"
  | "ROOM_GONE"
  | "BAD_REQUEST";
