"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
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

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return {
      errors: { password: "メールアドレスまたはパスワードが違います" },
      fields: { email },
    };
  }
  redirect("/");
}
