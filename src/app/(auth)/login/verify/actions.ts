"use server";

import type { TotpCodeState } from "../../_components/totp-code-form";
import { validateTotpCode } from "../../validation";
import { redirect } from "next/navigation";
import { requireAdminFirstFactor } from "@/lib/admin-authorization";
import { adminMfaState } from "@/lib/admin-mfa";

export async function verifyLoginCode(
  factorId: string,
  _prevState: TotpCodeState,
  formData: FormData,
): Promise<TotpCodeState> {
  const code = String(formData.get("code") ?? "").trim();

  const error = validateTotpCode(code);
  if (error) {
    return { error };
  }

  const { supabase, user } = await requireAdminFirstFactor();
  if (await adminMfaState(supabase, user) === "login") redirect("/login");
  const factor = user.factors?.find((item) => item.id === factorId && item.factor_type === "totp" && item.status === "verified");
  if (!factor) return { error: "認証アプリを選び直して、もう一度お試しください" };
  try {
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
    if (error) return { error: "確認できませんでした。新しいコードで再試行してください。連続失敗時は少し待ってください" };
    const fresh = await supabase.auth.getUser();
    if (fresh.error || await adminMfaState(supabase, fresh.data.user) !== "ready") return { error: "認証状態を確認できませんでした" };
  } catch { return { error: "認証サービスに接続できませんでした。もう一度お試しください" }; }
  redirect("/dashboard");
}
