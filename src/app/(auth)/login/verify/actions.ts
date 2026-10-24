"use server";

import type { TotpCodeState } from "../../_components/totp-code-form";
import { validateTotpCode } from "../../validation";

export async function verifyLoginCode(
  _prevState: TotpCodeState,
  formData: FormData,
): Promise<TotpCodeState> {
  const code = String(formData.get("code") ?? "").trim();

  const error = validateTotpCode(code);
  if (error) {
    return { error };
  }

  // TODO: Supabase接続後に実装する
  // - supabase.auth.mfa.challenge / verify でコードを検証
  // - 成功したらダッシュボード（/dashboard）へリダイレクト
  return { message: "認証処理はまだ実装されていません（ダミー）" };
}
