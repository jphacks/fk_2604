import { LogOut } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

type DashboardActionsProps = {
  /** ログイン中の管理者の名前 */
  name: string;
  /** ログアウトのサーバーアクション（機能はページ側から渡す） */
  logoutAction: () => Promise<void>;
};

/** ダッシュボードのヘッダー右側：「管理者 名前」とログアウト（ルーム作成はページ見出しの横） */
export function DashboardActions({ name, logoutAction }: DashboardActionsProps) {
  return (
    <>
      <p className="hidden items-baseline gap-3 text-sm md:flex">
        <span className="text-ink-muted">管理者</span>
        <span className="max-w-40 truncate text-ink">{name}</span>
      </p>
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
