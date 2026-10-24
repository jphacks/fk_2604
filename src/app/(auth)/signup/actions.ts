"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { validateEmail, validateNewPassword } from "../validation";

export type SignupState = {
  errors?: {
    email?: string;
    password?: string;
    passwordConfirm?: string;
  };
  // 入力エラー時にフォームへ戻す値（パスワードは戻さない）
  fields?: {
    email: string;
  };
  message?: string;
};

export async function signup(
  _prevState: SignupState,
  formData: FormData,
): Promise<SignupState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const passwordConfirm = String(formData.get("passwordConfirm") ?? "");

  const errors: SignupState["errors"] = {
    email: validateEmail(email),
    password: validateNewPassword(password),
    passwordConfirm: !passwordConfirm
      ? "確認用のパスワードを入力してください"
      : passwordConfirm !== password
        ? "パスワードが一致しません"
        : undefined,
  };
  if (errors.email || errors.password || errors.passwordConfirm) {
    return { errors, fields: { email } };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) {
    return {
      errors: { email: "登録処理に失敗しました。入力内容を確認してください" },
      fields: { email },
    };
  }
  if (!data.session) {
    return {
      fields: { email },
      message: "確認メールを送信しました。メールアドレスを確認してからログインしてください",
    };
  }
  redirect("/");
}
