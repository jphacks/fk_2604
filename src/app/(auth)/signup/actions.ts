"use server";

import { redirect } from "next/navigation";
import { toAuthErrorMessage } from "@/lib/supabase/auth-errors";
import { createClient } from "@/lib/supabase/server";
import { validateEmail, validateNewPassword } from "../validation";

export type SignupState = {
  errors?: { email?: string; password?: string; passwordConfirm?: string };
  fields?: { email: string };
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
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  let emailRedirectTo: string | undefined;
  if (siteUrl) {
    try {
      emailRedirectTo = new URL("/auth/callback", `${siteUrl}/`).toString();
    } catch {
      console.error("[auth] invalid NEXT_PUBLIC_SITE_URL");
      return {
        errors: { email: "認証設定に問題があります。管理者へ連絡してください" },
        fields: { email },
      };
    }
  }

  const signUpOptions = emailRedirectTo
    ? { email, password, options: { emailRedirectTo } }
    : { email, password };
  const { data, error } = await supabase.auth.signUp({
    ...signUpOptions,
  });
  if (error) {
    console.error("[auth] signup failed", {
      message: error.message,
      code: error.code ?? null,
      status: error.status ?? null,
    });
    return { errors: { email: toAuthErrorMessage(error) }, fields: { email } };
  }
  if (!data.session) {
    return {
      fields: { email },
      message: "確認メールを送信しました。メールアドレスを確認してからログインしてください",
    };
  }
  redirect("/dashboard");
}
