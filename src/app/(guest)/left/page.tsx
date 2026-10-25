import type { Metadata } from "next";
import Link from "next/link";

import { CloudIcon } from "@/components/brand/cloud-icon";

export const metadata: Metadata = {
  title: "退室しました",
};

// ゲストがチャット画面の「退室」から移ってくる画面。
// 画面を離れただけなので、ルームが消えるまではチャットに戻れる
export default async function LeftPage({ searchParams }: PageProps<"/left">) {
  const { room } = await searchParams;
  const roomId = typeof room === "string" ? room : null;

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-paper p-6 text-center text-ink">
      <CloudIcon className="h-16 w-24 opacity-70" />
      <h1 className="text-xl font-bold">トークルームから退室しました</h1>
      <p className="text-sm text-ink-muted">
        ルームが消えるまでは、もう一度チャットに戻ることができます。
      </p>
      {roomId && (
        <Link
          href={`/rooms/${encodeURIComponent(roomId)}`}
          className="mt-2 rounded-full px-4 py-2 text-sm font-medium underline underline-offset-4 hover:bg-cloud-pale"
        >
          チャットに戻る
        </Link>
      )}
    </main>
  );
}
