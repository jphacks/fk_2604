import { CloudIcon } from "@/components/brand/cloud-icon";

type RoomEndedProps = {
  reason: "gone" | "full";
};

const COPY = {
  gone: {
    title: "この雲は、空にとけました",
    body: "会話・ノート・ファイルは、すべて消えています。",
  },
  full: {
    title: "このルームは満員です",
    body: "参加人数の上限に達しています。",
  },
} as const;

/** ルーム消滅・満員の画面（S-10 の簡易版） */
export function RoomEnded({ reason }: RoomEndedProps) {
  const { title, body } = COPY[reason];
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-paper p-6 text-center text-ink">
      <CloudIcon className="h-16 w-24 opacity-70" />
      <h1 className="text-xl font-bold">{title}</h1>
      <p className="text-sm text-ink-muted">{body}</p>
    </main>
  );
}
