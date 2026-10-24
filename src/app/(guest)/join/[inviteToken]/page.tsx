import type { Metadata } from "next";

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { RoomPreview } from "@/types/room";
import { JoinForm } from "./_components/join-form";

export const metadata: Metadata = {
  title: "トークルームに入室",
};

function isRoomPreview(value: unknown): value is RoomPreview {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { id?: unknown }).id === "string" &&
    typeof (value as { name?: unknown }).name === "string"
  );
}

async function getRoomPreview(inviteToken: string): Promise<RoomPreview> {
  const { createHash } = await import("node:crypto");
  const supabase = await (await import("@/lib/supabase/server")).createClient();
  const tokenHash = createHash("sha256").update(inviteToken).digest("hex");
  const { data } = await supabase
    .rpc("get_room_by_invite", { p_token_hash: tokenHash })
    .maybeSingle();
  return isRoomPreview(data) ? data : { id: "", name: "利用できないルーム" };
}

export default async function JoinPage({
  params,
}: PageProps<"/join/[inviteToken]">) {
  const { inviteToken } = await params;
  const room = await getRoomPreview(inviteToken);

  return (
    <main className="flex flex-1 items-center justify-center bg-muted/40 px-4 py-12">
      <Card className="w-full max-w-sm">
        <CardHeader className="border-b text-center">
          <CardTitle className="text-lg">
            <span className="font-semibold">{room.name}</span>
            <span className="text-muted-foreground"> のトークルームに</span>
            <br />
            入室します
          </CardTitle>
          <CardDescription>
            チャットで表示するニックネームを入力してください
          </CardDescription>
        </CardHeader>
        <JoinForm inviteToken={inviteToken} />
      </Card>
    </main>
  );
}
