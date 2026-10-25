import type { Metadata } from "next";
import Link from "next/link";

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SignupForm } from "./_components/signup-form";

export const metadata: Metadata = {
  title: "新規登録",
};

export default function SignupPage() {
  return (
    <div className="flex w-full max-w-sm flex-col gap-4">
      <Card>
        <CardHeader className="border-b text-center">
          <CardTitle className="text-lg font-semibold">新規登録</CardTitle>
          <CardDescription>
            管理者アカウントを作成します
          </CardDescription>
        </CardHeader>
        <SignupForm />
      </Card>
      <p className="text-center text-sm text-muted-foreground">
        すでにアカウントをお持ちの方は{" "}
        <Link href="/login" className="font-medium text-foreground underline underline-offset-4">
          ログイン
        </Link>
      </p>
    </div>
  );
}
