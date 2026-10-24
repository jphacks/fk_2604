import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function RoomPage({
  params,
}: PageProps<"/room/[roomId]">) {
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
    .select("name")
    .eq("id", roomId)
    .maybeSingle();
  if (roomError || !room) notFound();

  return (
    <main className="flex flex-1 items-center justify-center">
      <section className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold">{room.name}</h1>
        <p className="text-sm text-muted-foreground">ルームに参加しています</p>
      </section>
    </main>
  );
}
