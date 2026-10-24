"use server";

import { NICKNAME_MAX_LENGTH } from "./constants";

export type JoinRoomState = {
  errors?: {
    nickname?: string;
    password?: string;
  };
  message?: string;
};

export async function joinRoom(
  _prevState: JoinRoomState,
  formData: FormData,
): Promise<JoinRoomState> {
  const nickname = String(formData.get("nickname") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const errors: JoinRoomState["errors"] = {};
  if (!nickname) {
    errors.nickname = "ニックネームを入力してください";
  } else if (nickname.length > NICKNAME_MAX_LENGTH) {
    errors.nickname = `ニックネームは${NICKNAME_MAX_LENGTH}文字以内で入力してください`;
  }
  if (!password) {
    errors.password = "参加用パスワードを入力してください";
  }
  if (errors.nickname || errors.password) {
    return { errors };
  }

  // TODO: Redis接続後に実装する
  // - 招待トークンの有効期限チェック
  // - 参加用パスワードの照合
  // - 人数上限チェック
  // - 一時ユーザーIDの発行とCookie保存
  // - チャットルームへリダイレクト
  return { message: "入室処理はまだ実装されていません（ダミー）" };
}
