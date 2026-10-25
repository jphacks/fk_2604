import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** 管理者の表示名（あいさつ・ヘッダー用）。プロフィールの表示名がなければメールアドレスの @ より前 */
export async function getDisplayName(supabase: Supabase, userId: string, email?: string) {
  const { data } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", userId)
    .maybeSingle();
  return data?.display_name || email?.split("@")[0] || "管理者";
}
