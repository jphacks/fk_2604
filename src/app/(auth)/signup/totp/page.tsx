import type { Metadata } from "next";
import { QrCode } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TotpCodeForm } from "../../_components/totp-code-form";
import { verifyTotpEnrollment } from "./actions";

export const metadata: Metadata = {
  title: "認証アプリの設定",
};

// TODO: Supabase接続後、supabase.auth.mfa.enroll({ factorType: "totp" }) の
// 戻り値（totp.qr_code: SVGのdata URL、totp.secret）を使う
const DUMMY_SECRET = "JBSW Y3DP EHPK 3PXP";

export default function SignupTotpPage() {
  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="border-b text-center">
        <CardTitle className="text-lg font-semibold">認証アプリの設定</CardTitle>
        <CardDescription>
          ログインのたびに使う認証アプリを登録します
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        <p className="text-sm">
          <span className="font-medium">1.</span> Google Authenticator などの認証アプリで、このQRコードを読み取ってください
        </p>
        <div
          className="mx-auto flex size-40 items-center justify-center rounded-lg border border-dashed bg-muted/50 text-muted-foreground"
          role="img"
          aria-label="QRコード（ダミー）"
        >
          <QrCode className="size-16" aria-hidden />
        </div>
        <p className="text-center text-xs text-muted-foreground">
          読み取れない場合はこのキーを入力:{" "}
          <code className="font-mono text-foreground">{DUMMY_SECRET}</code>
        </p>
        <p className="text-sm">
          <span className="font-medium">2.</span> アプリに表示された6桁のコードを入力してください
        </p>
      </CardContent>

      <TotpCodeForm action={verifyTotpEnrollment} submitLabel="登録を完了" />
    </Card>
  );
}
