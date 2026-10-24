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

// TODO: Redis接続後、招待トークンからルーム情報を取得する
async function getRoomPreview(inviteToken: string): Promise<RoomPreview> {
  return { id: `dummy-${inviteToken}`, name: "誕生日サプライズ" };
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
            ニックネームと参加用パスワードを入力してください
          </CardDescription>
        </CardHeader>
        <JoinForm />
      </Card>
    </main>
  );
}
