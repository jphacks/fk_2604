import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { DashboardActions } from "@/components/dashboard/dashboard-actions";
import { PageShell } from "@/components/layout/page-shell";
import { getDisplayName } from "@/lib/display-name";
import { createClient } from "@/lib/supabase/server";
import { logout } from "../../../(auth)/login/logout-actions";
import { RoomCreateForm } from "./_components/room-create-form";

export const metadata: Metadata = {
  title: "新規ルーム作成",
};

/** ヘッダー右の「管理者 名前」。ログインしていなければ何も出さない */
async function getHeaderActions() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.is_anonymous) return null;
  const name = await getDisplayName(supabase, user.id, user.email);
  return <DashboardActions name={name} logoutAction={logout} />;
}

// TODO: Supabase接続後、未ログインなら /login へリダイレクトする
export default async function NewRoomPage() {
  return (
    // 背景はチャット画面と同じ、空のグラデーション＋ふんわりした雲（globals.css の bg-sky-clouds）
    <PageShell
      className="bg-sky-clouds"
      logoHref="/dashboard"
      actions={await getHeaderActions()}
      footer
    >
      <main className="mx-auto w-full max-w-xl flex-1 px-5 pt-8 pb-16 md:pt-10">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 rounded-md text-xs font-bold text-cloud-deep outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          メインに戻る
        </Link>
        <h1 className="mt-5 text-2xl font-bold md:text-[28px]">新しいくもを、つくろう。</h1>
        <p className="mt-3 text-sm text-ink-muted">
          必要な期間だけ、気軽に集まれる。
          <br />
          終われば雲のように自然に消えていくトークルーム。
        </p>

        <RoomCreateForm />

        <p className="mt-5 text-xs text-ink-muted">終了日の23:59になると、ルームは消えます。</p>
      </main>
    </PageShell>
  );
}
