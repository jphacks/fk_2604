"use server";

import type { TotpCodeState } from "../../_components/totp-code-form";
import { validateTotpCode } from "../../validation";
import { redirect } from "next/navigation";
import { requireAdminFirstFactor, requireAdminAal2 } from "@/lib/admin-authorization";
import { adminMfaDestination, adminMfaState } from "@/lib/admin-mfa";

export type EnrollmentState = {
  error?: string;
  enrollment?: { factorId: string; qrCode: string; secret: string };
};

export async function startTotpEnrollment(): Promise<EnrollmentState> {
  const { supabase, user } = await requireAdminFirstFactor();
  const state = await adminMfaState(supabase, user);
  if (state !== "enroll") redirect(adminMfaDestination(state));
  try {
    // Clean up only this application's unfinished factors, never verified factors.
    // Starting again in another tab invalidates the old unfinished QR, safely.
    for (const factor of user.factors ?? []) {
      if (factor.factor_type === "totp" && factor.status === "unverified" && factor.friendly_name?.startsWith("KumoTalk ")) {
        const removed = await supabase.auth.mfa.unenroll({ factorId: factor.id });
        if (removed.error) return { error: "未完了の設定を整理できませんでした。もう一度お試しください" };
      }
    }
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp", issuer: "KumoTalk", friendlyName: `KumoTalk ${crypto.randomUUID()}`,
    });
    if (error) return { error: "認証アプリの設定を開始できませんでした。少し待って再試行してください" };
    return { enrollment: { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret } };
  } catch { return { error: "認証サービスに接続できませんでした" }; }
}

export async function verifyTotpEnrollment(
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
  const state = await adminMfaState(supabase, user);
  if (state !== "enroll") redirect(adminMfaDestination(state));
  const factor = user.factors?.find((item) => item.id === factorId && item.factor_type === "totp" && item.status === "unverified");
  if (!factor) return { error: "この設定は無効です。設定を開始し直してください" };
  try {
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
    if (error) return { error: "確認できませんでした。新しいコードで再試行してください。連続失敗時は少し待ってください" };
    const fresh = await supabase.auth.getUser();
    if (fresh.error || await adminMfaState(supabase, fresh.data.user) !== "ready") return { error: "認証状態を確認できませんでした" };
  } catch { return { error: "認証サービスに接続できませんでした" }; }
  redirect("/dashboard");
}

// Backend-only management actions, for a future existing-UI connection or an
// authenticated operator tool. Never expose service-role recovery through these.
export async function addTotpFactor(): Promise<EnrollmentState> {
  const { supabase } = await requireAdminAal2();
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp", issuer: "KumoTalk", friendlyName: `KumoTalk ${crypto.randomUUID()}`,
  });
  if (error) return { error: "追加登録を開始できませんでした" };
  return { enrollment: { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret } };
}

export async function verifyAdditionalTotpFactor(factorId: string, code: string) {
  const { supabase, user } = await requireAdminAal2();
  if (validateTotpCode(code)) return { error: "6桁のコードを入力してください" };
  if (!user.factors?.some((factor) => factor.id === factorId && factor.factor_type === "totp" && factor.status === "unverified")) {
    return { error: "対象の登録を確認できませんでした" };
  }
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
  return error ? { error: "確認できませんでした。新しいコードで再試行してください" } : { success: true };
}

export async function removeTotpFactor(factorId: string) {
  const { supabase, user } = await requireAdminAal2();
  const verified = user.factors?.filter((factor) => factor.factor_type === "totp" && factor.status === "verified") ?? [];
  if (!verified.some((factor) => factor.id === factorId)) return { error: "対象の登録を確認できませんでした" };
  if (verified.length < 2) return { error: "先に新しい認証アプリを登録・確認してください" };
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  return error ? { error: "登録を解除できませんでした" } : { success: true };
}
