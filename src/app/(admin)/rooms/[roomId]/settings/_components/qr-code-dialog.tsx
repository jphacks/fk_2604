"use client";

import { QRCodeSVG } from "qrcode.react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// 共有URLのQRコードを大きく表示するポップアップ。
// スマホで読み取らせている途中に誤って閉じないよう、外側のクリックでは閉じない（×ボタンとEscキーのみ）
export function QrCodeDialog({
  inviteUrl,
  open,
  onOpenChange,
}: {
  inviteUrl: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} disablePointerDismissal>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>共有用QRコード</DialogTitle>
          <DialogDescription>
            スマートフォンのカメラで読み取ると、入室画面が開きます
          </DialogDescription>
        </DialogHeader>

        {/* ダークモードでも読み取れるよう、白い台紙の上に黒で描く */}
        <div className="mx-auto rounded-lg bg-white p-4 ring-1 ring-foreground/10">
          <QRCodeSVG
            value={inviteUrl}
            size={240}
            marginSize={0}
            role="img"
            aria-label="共有用URLのQRコード"
          />
        </div>
        <p className="text-center text-xs text-muted-foreground">
          ※ 毎日0:00（日本時間）に更新されます。更新後は、このQRコードからは入室できません
        </p>
      </DialogContent>
    </Dialog>
  );
}
