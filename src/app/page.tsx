import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

// トップページは管理者（アカウントを持っている人）向けの入り口。
// ゲストは招待URL（/join/[inviteToken]）から直接入るので、ここには来ない想定。
// 入室時の匿名ログインはアカウントではないので、ログインしていない扱いにする
export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user && !user.is_anonymous) redirect("/dashboard");
  redirect("/login");
}
