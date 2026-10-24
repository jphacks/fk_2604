"use server";

import { NICKNAME_MAX_LENGTH } from "./constants";

export type JoinRoomState = {
  errors?: {
    nickname?: string;
  };
  // 入力エラー時にフォームへ戻す値
  fields?: {
    nickname: string;
  };
  message?: string;
};

export async function joinRoom(
  _prevState: JoinRoomState,
  formData: FormData,
): Promise<JoinRoomState> {
  const nickname = String(formData.get("nickname") ?? "").trim();

  const errors: JoinRoomState["errors"] = {};
  if (!nickname) {
    errors.nickname = "ニックネームを入力してください";
  } else if (nickname.length > NICKNAME_MAX_LENGTH) {
    errors.nickname = `ニックネームは${NICKNAME_MAX_LENGTH}文字以内で入力してください`;
  }
  if (errors.nickname) {
    return { errors, fields: { nickname } };
  }

  // TODO: Redis接続後に実装する
  // - 招待トークンの有効性チェック（更新済みの古いトークンなら入室不可）
  // - 一時ユーザーIDの発行とCookie保存
  // - チャットルームへリダイレクト
  return { message: "入室処理はまだ実装されていません（ダミー）" };
}
