// 入室前のゲストに見せてよいルーム情報
export type RoomPreview = {
  id: string;
  name: string;
  /** 以下は入室画面の表示用。DB の関数が古い（マイグレーション前）ときは入らない */
  expiresAt?: number; // epoch ms
  maxMembers?: number | null;
  memberCount?: number;
};
