import Link from "next/link";
import { LogOut, Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type DashboardActionsProps = {
  email?: string;
  /** ログアウトのサーバーアクション（機能はページ側から渡す） */
  logoutAction: () => Promise<void>;
};

/** ダッシュボードのヘッダー右側：ログイン中のメール・ルーム作成・ログアウト */
export function DashboardActions({ email, logoutAction }: DashboardActionsProps) {
  return (
    <>
      {email && (
        <span className="hidden max-w-48 truncate text-sm text-ink-muted md:inline">{email}</span>
      )}
      {/* S-05 新規ルーム作成（src/app/(admin)/rooms/new）へ */}
      <Link href="/rooms/new" className={cn(buttonVariants({ size: "lg" }), "px-4")}>
        <Plus aria-hidden />
        ルーム作成
      </Link>
      <form action={logoutAction}>
        <button
          type="submit"
          className={buttonVariants({ variant: "ghost", size: "icon-lg" })}
          aria-label="ログアウト"
          title="ログアウト"
        >
          <LogOut aria-hidden />
        </button>
      </form>
    </>
  );
}
