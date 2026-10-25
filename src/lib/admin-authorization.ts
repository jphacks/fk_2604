import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { adminMfaDestination, adminMfaState } from "@/lib/admin-mfa";

export async function requireAdminAal2() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user || user.is_anonymous) redirect("/login");
  const state = await adminMfaState(supabase, user);
  if (state !== "ready") redirect(adminMfaDestination(state));
  return { supabase, user };
}

export async function requireAdminFirstFactor() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user || user.is_anonymous) redirect("/login");
  return { supabase, user };
}
