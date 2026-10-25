import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeftIcon } from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

  return (
    <main className="flex flex-1 items-center justify-center bg-muted/40 px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="border-b">
          <Link
            href={`/rooms/${room.id}`}
            className="-ml-2 flex w-fit items-center gap-1 rounded-full px-2 py-1 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ChevronLeftIcon className="size-4" aria-hidden />
            チャットに戻る
          </Link>
          <CardTitle className="text-lg font-semibold">
            {room.name} のトークルーム〈設定〉
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <ShareUrlSection inviteUrl={inviteUrl} />
          <hr />
          <PeriodForm
            roomId={room.id}
            initialStartDate={startDate}
            initialEndDate={endDate}
            started={startDate <= todayJst()}
          />
        </CardContent>
      </Card>
    </main>
  );
}
