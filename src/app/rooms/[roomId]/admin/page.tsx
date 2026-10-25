import { Chats } from "@/components/chats";

// 管理者ページ。現時点ではログインなしの参加者と同じチャット画面を表示する
// Next.js 16 では params は Promise なので await が必要
export default async function RoomAdminPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = await params;
  return <Chats roomId={roomId} />;
}
