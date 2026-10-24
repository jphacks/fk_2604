"use server";

import type { TotpCodeState } from "../../_components/totp-code-form";
import { validateTotpCode } from "../../validation";

export async function verifyTotpEnrollment(
  _prevState: TotpCodeState,
  formData: FormData,
): Promise<TotpCodeState> {
  const code = String(formData.get("code") ?? "").trim();

  const error = validateTotpCode(code);
  if (error) {
    return { error };
  }

  // TODO: Supabase接続後に実装する
  // - supabase.auth.mfa.challenge / verify で登録を確定
  // - 成功したらダッシュボード（/dashboard）へリダイレクト
  return { message: "登録処理はまだ実装されていません（ダミー）" };
}
