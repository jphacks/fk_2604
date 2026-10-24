import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logout } from "../(auth)/login/logout-actions";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.is_anonymous) redirect("/login");
  return (
    <main className="flex flex-1 items-center justify-center">
      <div className="flex flex-col gap-4">
        <h1 className="text-xl font-semibold">管理画面</h1>
        <p className="text-sm text-muted-foreground">{user.email}</p>
        <form action={logout}>
          <button type="submit" className="underline">ログアウト</button>
        </form>
      </div>
    </main>
  );
}
