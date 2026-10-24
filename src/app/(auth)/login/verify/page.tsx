import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TotpCodeForm } from "../../_components/totp-code-form";
import { verifyLoginCode } from "./actions";

export const metadata: Metadata = {
  title: "二要素認証",
};

export default function LoginVerifyPage() {
  return (
    <div className="flex w-full max-w-sm flex-col gap-4">
      <Card>
        <CardHeader className="border-b text-center">
          <ShieldCheck className="mx-auto mb-1 size-8 text-muted-foreground" aria-hidden />
          <CardTitle className="text-lg font-semibold">二要素認証</CardTitle>
          <CardDescription>
            認証アプリに表示されている6桁のコードを入力してください
          </CardDescription>
        </CardHeader>
        <TotpCodeForm action={verifyLoginCode} submitLabel="ログイン" />
      </Card>
      <p className="text-center text-sm text-muted-foreground">
        <Link href="/login" className="underline underline-offset-4">
          ログイン画面に戻る
        </Link>
      </p>
    </div>
  );
}
