"use client";

import { useEffect, useRef, useState } from "react";
import { QrCode } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TotpCodeForm } from "../../_components/totp-code-form";
import { startTotpEnrollment, verifyTotpEnrollment, type EnrollmentState } from "./actions";
import { siteConfig } from "@/config/site";

export default function SignupTotpPage() {
  const [state, setState] = useState<EnrollmentState>({});
  const pending = useRef<Promise<EnrollmentState> | null>(null);
  useEffect(() => {
    document.title = `認証アプリの設定 | ${siteConfig.name}`;
    let active = true;
    // Reuse one POST across Strict Mode effect replays. A real reload starts a
    // fresh enrollment and safely invalidates this app's abandoned pending QR.
    pending.current ??= startTotpEnrollment();
    pending.current.then((result) => { if (active) setState(result); })
      .catch(() => { if (active) setState({ error: "設定を取得できませんでした。画面を更新して再試行してください" }); });
    return () => { active = false; };
  }, []);
  const enrollment = state.enrollment;
  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="border-b text-center">
        <CardTitle className="text-lg font-semibold">認証アプリの設定</CardTitle>
        <CardDescription>
          {state.error ?? "ログインのたびに使う認証アプリを登録します"}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        <p className="text-sm">
          <span className="font-medium">1.</span> Google Authenticator などの認証アプリで、このQRコードを読み取ってください
        </p>
        <div
          className="mx-auto flex size-40 items-center justify-center rounded-lg border border-dashed bg-muted/50 text-muted-foreground"
          role="img"
          aria-label={enrollment ? "認証アプリ登録用QRコード" : "QRコードを取得中"}
        >
          {enrollment ? (
            // Supabase SVG is rendered as an image, never injected as HTML.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={enrollment.qrCode} width={144} height={144} alt="Google Authenticator登録用QRコード" />
          ) : <QrCode className="size-16" aria-hidden />}
        </div>
        <p className="text-center text-xs text-muted-foreground">
          読み取れない場合はこのキーを入力:{" "}
          <code className="font-mono text-foreground">{enrollment?.secret ?? "取得中…"}</code>
        </p>
        <p className="text-sm">
          <span className="font-medium">2.</span> アプリに表示された6桁のコードを入力してください
        </p>
      </CardContent>

      <TotpCodeForm action={verifyTotpEnrollment.bind(null, enrollment?.factorId ?? "")} submitLabel="登録を完了" />
    </Card>
  );
}
