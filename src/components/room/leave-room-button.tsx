"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * ゲスト用の退室ボタン。押すと確認を出し、「退室する」で /left（退室しました画面）へ移る。
 * 画面を離れるだけで、ログイン状態やメンバー登録はそのまま（ブラウザの「戻る」でチャットに戻れる）
 */
export function LeaveRoomButton({ roomId }: { roomId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-full px-2 py-2 text-[15px] font-medium hover:bg-cloud-pale"
      >
        <LogOut className="size-5" aria-hidden />
        退室
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>トークルームから退室しますか？</DialogTitle>
            <DialogDescription>
              退室しても、ルームが消えるまではブラウザの「戻る」でチャットに戻れます。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              キャンセル
            </Button>
            <Button type="button" onClick={() => router.push(`/left?room=${encodeURIComponent(roomId)}`)}>
              退室する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
