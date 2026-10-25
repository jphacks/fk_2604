"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

// ルーム作成後に共有URLを表示するダイアログ。閉じるとチャット画面へ進む
export function ShareUrlDialog({
  inviteUrl,
  onClose,
}: {
  inviteUrl: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // クリップボードが使えない環境では、入力欄を選択して手動でコピーしてもらう
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>共有用URL</DialogTitle>
          <DialogDescription>
            このURLを参加してほしい人に送ってください
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          <Input
            value={inviteUrl}
            readOnly
            aria-label="共有用URL"
            onFocus={(e) => e.currentTarget.select()}
            className="font-mono text-xs md:text-xs"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={handleCopy}
            aria-label={copied ? "コピーしました" : "URLをコピー"}
          >
            {copied ? <Check /> : <Copy />}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          ※ 毎日0:00（日本時間）に新しいURLに更新されます。更新後は、このURLからは入室できません
        </p>

        <DialogFooter>
          <Button type="button" onClick={onClose}>
            閉じる
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
