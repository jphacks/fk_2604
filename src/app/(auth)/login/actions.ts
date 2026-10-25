"use server";

import { redirect } from "next/navigation";
import { toAuthErrorMessage } from "@/lib/supabase/auth-errors";
import { createClient } from "@/lib/supabase/server";
import { validateEmail } from "../validation";
import { adminMfaDestination, adminMfaState } from "@/lib/admin-mfa";

export type LoginState = {
  errors?: { email?: string; password?: string };
  fields?: { email: string };
  message?: string;
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
  if (errors.email || errors.password) return { errors, fields: { email } };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return { errors: { password: toAuthErrorMessage(error) }, fields: { email } };
  }
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user || user.is_anonymous) return { message: "ログイン状態を確認できませんでした" };
  let destination: string;
  try { destination = adminMfaDestination(await adminMfaState(supabase, user)); }
  catch { return { message: "認証状態を確認できませんでした。もう一度お試しください" }; }
  redirect(destination);
}
