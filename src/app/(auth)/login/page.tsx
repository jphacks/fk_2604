import type { Metadata } from "next";
import Link from "next/link";

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LoginForm } from "./_components/login-form";

export const metadata: Metadata = {
  title: "ログイン",
};

export default function LoginPage() {
  return (
    <div className="flex w-full max-w-sm flex-col gap-4">
      <Card>
        <CardHeader className="border-b text-center">
          <CardTitle className="text-lg font-semibold">ログイン</CardTitle>
          <CardDescription>管理者アカウントでログインしてください</CardDescription>
        </CardHeader>
        <LoginForm />
      </Card>
      <p className="text-center text-sm text-muted-foreground">
        アカウントをお持ちでない方は{" "}
        <Link href="/signup" className="font-medium text-foreground underline underline-offset-4">
          新規登録
        </Link>
      </p>
    </div>
  );
}
