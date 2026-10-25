import { Chats } from "@/components/chats";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";

export default async function RoomPage({
  params,
}: PageProps<"/rooms/[roomId]">) {
  const { roomId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();

  const { data: allowed, error: authorizationError } = await supabase.rpc(
    "is_active_room_member",
    { p_room_id: roomId, p_user_id: user.id },
  );
  if (authorizationError || !allowed) notFound();

  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .select("id, owner_id")
    .eq("id", roomId)
    .maybeSingle();
  if (roomError || !room) notFound();

  // ルームの作成者（管理者）だけに設定ボタンを出す。設定ページ側でも同じ判定をしている
  const isOwner = !user.is_anonymous && room.owner_id === user.id;

  return <Chats roomId={roomId} isOwner={isOwner} />;
}
