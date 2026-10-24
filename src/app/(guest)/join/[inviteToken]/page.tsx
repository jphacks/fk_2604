import type { Metadata } from "next";

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getRoom, resolveInvite } from "@/lib/dev-store";
import type { RoomPreview } from "@/types/room";
import { JoinForm } from "./_components/join-form";

export const metadata: Metadata = {
  title: "トークルームに入室",
};

// TODO: Redis接続後、dev-store を lib/redis/ の実装に差し替える
async function getRoomPreview(inviteToken: string): Promise<RoomPreview | null> {
  const roomId = resolveInvite(inviteToken);
  const room = roomId ? getRoom(roomId) : null;
  return room ? { id: room.info.id, name: room.info.name } : null;
}

export default async function JoinPage({
  params,
}: PageProps<"/join/[inviteToken]">) {
  const { inviteToken } = await params;
  const room = await getRoomPreview(inviteToken);

  return (
    <main className="flex flex-1 items-center justify-center bg-muted/40 px-4 py-12">
      <Card className="w-full max-w-sm">
        {room ? (
          <>
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
          </>
        ) : (
          <CardHeader className="text-center">
            <CardTitle className="text-lg font-semibold">
              この招待URLは使えません
            </CardTitle>
            <CardDescription>
              招待URLは毎日0:00に更新されるため、期限が切れているか、ルームがすでに消滅しています。招待した人に新しいURLをもらってください
            </CardDescription>
          </CardHeader>
        )}
      </Card>
    </main>
  );
}
