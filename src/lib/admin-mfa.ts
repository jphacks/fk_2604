import type { SupabaseClient, User } from "@supabase/supabase-js";

export type AdminMfaState = "login" | "enroll" | "verify" | "ready";

// getAuthenticatorAssuranceLevel() without a JWT reads the locally stored session.
// Server authorization must use signature-verified claims and a fresh Auth user.
export async function adminMfaState(client: SupabaseClient, user: User | null): Promise<AdminMfaState> {
  if (!user || user.is_anonymous) return "login";
  const { data, error } = await client.auth.getClaims();
  if (error || !data || data.claims.sub !== user.id || data.claims.is_anonymous === true) {
    throw new Error("Cannot validate administrator session");
  }
  // A signed access token can outlive sign-out or a lost-phone MFA reset. Do not
  // let it regain owner access if a new factor is later enrolled on the account.
  const live = await client.rpc("admin_mfa_session_is_live");
  if (live.error) throw new Error("Cannot validate administrator session revocation");
  if (live.data !== true) return "login";
  const verifiedTotp = user.factors?.some((factor) => factor.factor_type === "totp" && factor.status === "verified");
  if (!verifiedTotp) return "enroll";
  return data.claims.aal === "aal2" ? "ready" : "verify";
}

export function adminMfaDestination(state: AdminMfaState) {
  return state === "ready" ? "/dashboard" : state === "verify" ? "/login/verify"
    : state === "enroll" ? "/signup/totp" : "/login";
}

export function safeAuthNext(path: string | null) {
  if (!path?.startsWith("/") || path.startsWith("//") || path.includes("\\")) return "/dashboard";
  const base = new URL("https://kumotalk.invalid");
  const target = new URL(path, base);
  return target.origin === base.origin ? `${target.pathname}${target.search}${target.hash}` : "/dashboard";
}
