import type { Metadata } from "next";

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { RoomCreateForm } from "./_components/room-create-form";

export const metadata: Metadata = {
  title: "新規ルーム作成",
};

// TODO: Supabase接続後、未ログインなら /login へリダイレクトする
export default function NewRoomPage() {
  return (
    <main className="flex flex-1 items-center justify-center bg-muted/40 px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="border-b">
          <CardTitle className="text-lg font-semibold">新規ルーム作成</CardTitle>
          <CardDescription>
            予定に合わせて利用期間を決めてください。期間が終わるとメッセージはすべて消えます
          </CardDescription>
        </CardHeader>
        <RoomCreateForm />
      </Card>
    </main>
  );
}
