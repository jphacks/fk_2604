import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { logout } from "@/app/(auth)/login/logout-actions";
import { DashboardActions } from "@/components/dashboard/dashboard-actions";
import { PageShell } from "@/components/layout/page-shell";
import { getDisplayName } from "@/lib/display-name";
import { ensureTodayInvite, inviteUrlFor } from "@/lib/invite";
import { todayJst, toJstDate } from "@/lib/room-period";
import { createClient } from "@/lib/supabase/server";
import { PeriodForm } from "./_components/period-form";
import { ShareUrlSection } from "./_components/share-url-section";

export const metadata: Metadata = {
  title: "トークルームの設定",
};

export default async function RoomSettingsPage({
  params,
}: PageProps<"/rooms/[roomId]/settings">) {
  const { roomId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.is_anonymous) redirect("/login");

  // ルームの作成者だけが開ける（それ以外・消滅済みは 404）
  const { data: room } = await supabase
    .from("rooms")
    .select("id, name, owner_id, starts_at, expires_at")
    .eq("id", roomId)
    .maybeSingle();
  if (!room || room.owner_id !== user.id) notFound();

  // 開いた日の招待URL（0:00 を過ぎて初めて開いたときに新しいURLが発行される）
  // 発行に失敗しても、利用期間の変更はできるようにページは表示する
  let inviteUrl: string | null = null;
  try {
    const inviteToken = await ensureTodayInvite(supabase, room.id, Date.parse(room.expires_at));
    inviteUrl = await inviteUrlFor(inviteToken);
  } catch {
    inviteUrl = null;
  }

  const startDate = toJstDate(room.starts_at);
  const endDate = toJstDate(room.expires_at);
  const displayName = await getDisplayName(supabase, user.id, user.email);

  return (
    <PageShell
      logoHref="/dashboard"
      actions={<DashboardActions name={displayName} logoutAction={logout} />}
      footer
    >
      <main className="mx-auto w-full max-w-xl flex-1 px-5 pt-8 pb-16 md:pt-10">
        <Link
          href={`/rooms/${room.id}`}
          className="inline-flex items-center gap-1.5 rounded-md text-xs font-bold text-cloud-deep outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          チャットに戻る
        </Link>
        <p className="mt-5 text-xs font-bold tracking-wide text-cloud-deep md:text-sm">トークルームの設定</p>
        <h1 className="mt-2 text-2xl font-bold break-all md:text-[28px]">{room.name}</h1>
        <p className="mt-3 text-sm text-ink-muted">招待URLの共有と、利用期間の変更ができます。</p>

        <div className="mt-8 flex flex-col gap-6 rounded-3xl bg-card p-6 ring-1 ring-line md:p-8">
          <ShareUrlSection inviteUrl={inviteUrl} />
          <hr className="border-line" />
          <PeriodForm
            roomId={room.id}
            initialStartDate={startDate}
            initialEndDate={endDate}
            started={startDate <= todayJst()}
          />
        </div>

        <p className="mt-5 text-xs text-ink-muted">終了日の23:59になると、ルームは消えます。</p>
      </main>
    </PageShell>
  );
}
