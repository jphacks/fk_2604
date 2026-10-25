"use client";

import { useState } from "react";
import { Check, Copy, QrCode } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QrCodeDialog } from "./qr-code-dialog";

export function ShareUrlSection({ inviteUrl }: { inviteUrl: string | null }) {
  const [copied, setCopied] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);

  if (!inviteUrl) {
    return (
      <section className="flex flex-col gap-2" aria-labelledby="share-url-heading">
        <h2 id="share-url-heading" className="text-sm font-medium">
          共有URL
        </h2>
        <p role="alert" className="text-sm text-destructive">
          共有URLを発行できませんでした。時間をおいてページを再読み込みしてください
        </p>
      </section>
    );
  }

  async function handleCopy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // クリップボードが使えない環境では、入力欄を選択して手動でコピーしてもらう
    }
  }

  return (
    <section className="flex flex-col gap-2" aria-labelledby="share-url-heading">
      <h2 id="share-url-heading" className="text-sm font-medium">
        共有URL
      </h2>
      <div className="flex gap-2">
        <Input
          value={inviteUrl}
          readOnly
          aria-labelledby="share-url-heading"
          onFocus={(e) => e.currentTarget.select()}
          className="font-mono text-xs md:text-xs"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => handleCopy(inviteUrl)}
          aria-label={copied ? "コピーしました" : "URLをコピー"}
        >
          {copied ? <Check /> : <Copy />}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        ※ 毎日0:00（日本時間）に新しいURLに自動で更新されます。更新後は、前のURLからは入室できません
      </p>
      <Button type="button" variant="outline" className="self-start" onClick={() => setQrOpen(true)}>
        <QrCode />
        QRコードを表示
      </Button>

      <QrCodeDialog inviteUrl={inviteUrl} open={qrOpen} onOpenChange={setQrOpen} />
    </section>
  );
}
