import { Chats } from "@/components/chats";
import { getActor } from "@/lib/session";

// Next.js 16 では params は Promise なので await が必要
export default async function RoomPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = await params;

  // 入室画面（/join/[inviteToken]）で発行された参加証の Cookie がなければ入れない
  const me = await getActor(roomId);
  if (!me) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-2 bg-slate-100 p-4 text-center">
        <p className="text-lg font-bold">このルームにはまだ入室していません</p>
        <p className="text-sm text-slate-500">
          招待URLを開いて、ニックネームを入力してから入室してください
        </p>
      </main>
    );
  }

  return <Chats roomId={roomId} me={me} />;
}
