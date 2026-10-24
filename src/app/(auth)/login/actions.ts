"use server";

import { redirect } from "next/navigation";

import { validateEmail } from "../validation";

export type LoginState = {
  errors?: {
    email?: string;
    password?: string;
  };
  // 入力エラー時にフォームへ戻す値（パスワードは戻さない）
  fields?: {
    email: string;
  };
};

export async function login(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const errors: LoginState["errors"] = {
    email: validateEmail(email),
    password: password ? undefined : "パスワードを入力してください",
  };
  if (errors.email || errors.password) {
    return { errors, fields: { email } };
  }

  // TODO: Supabase接続後に実装する
  // - supabase.auth.signInWithPassword でメールアドレスとパスワードを照合
  // - 失敗時は「メールアドレスまたはパスワードが違います」を返す
  redirect("/login/verify");
}
