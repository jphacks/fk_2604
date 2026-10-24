import { Chats } from "@/components/chats";

// Next.js 16 では params は Promise なので await が必要
export default async function RoomPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = await params;
  return <Chats roomId={roomId} />;
}
