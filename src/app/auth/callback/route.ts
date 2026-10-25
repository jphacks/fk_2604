import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { adminMfaDestination, adminMfaState, safeAuthNext } from "@/lib/admin-mfa";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next");
  if (!code) return NextResponse.redirect(new URL("/login", url));
  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(new URL("/login?error=confirmation", url));
  }
  const { data: { user } } = await supabase.auth.getUser();
  try {
    const state = await adminMfaState(supabase, user);
    return NextResponse.redirect(new URL(state === "ready" ? safeAuthNext(next) : adminMfaDestination(state), url));
  } catch { return NextResponse.redirect(new URL("/login?error=mfa", url)); }
}
