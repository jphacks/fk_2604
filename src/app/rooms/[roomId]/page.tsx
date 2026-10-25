import { Chats } from "@/components/chats";
import { syncRoomInfo } from "@/lib/dev-store";
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
    .select("id, owner_id, name, max_members, expires_at")
    .eq("id", roomId)
    .maybeSingle();
  if (roomError || !room) notFound();

  // ルームの作成者（管理者）だけに設定ボタンを出す。設定ページ側でも同じ判定をしている
  const isOwner = !user.is_anonymous && room.owner_id === user.id;

  // ニックネームは招待リンクの入室フォームで登録したものを使う（チャット画面では聞き直さない）
  // 管理者は room_members に入らないので、プロフィールの表示名を使う
  let nickname = "管理者";
  if (isOwner) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .maybeSingle();
    if (profile?.display_name) nickname = profile.display_name;
  } else {
    const { data: member } = await supabase
      .from("room_members")
      .select("nickname")
      .eq("room_id", roomId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!member) notFound();
    nickname = member.nickname;
  }

  // チャットは Redis（lib/dev-store.ts）に保存しているので、DBのルーム名・期限をそちらに反映する
  await syncRoomInfo({
    id: room.id,
    name: room.name,
    maxMembers: room.max_members,
    expiresAt: Date.parse(room.expires_at),
  });

  return (
    <Chats
      roomId={roomId}
      me={{ guestId: user.id, nickname }}
      isOwner={isOwner}
    />
  );
}
