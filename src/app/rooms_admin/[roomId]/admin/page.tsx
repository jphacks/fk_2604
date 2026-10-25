import { redirect } from "next/navigation";

// 旧URL。認証・ニックネームは /rooms/[roomId] 側で扱うので、そちらへ転送する
// Next.js 16 では params は Promise なので await が必要
export default async function RoomAdminRedirect({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = await params;
  redirect(`/rooms/${roomId}`);
}
