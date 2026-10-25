import { Chats } from "@/components/chats";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";

// Next.js 16 では params は Promise なので await が必要
export default async function RoomPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
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
    .select("id")
    .eq("id", roomId)
    .maybeSingle();
  if (roomError || !room) notFound();

  return <Chats roomId={roomId} />;
}
