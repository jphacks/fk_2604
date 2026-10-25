import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/brand/logo";

type AppHeaderProps = {
  /** 右側に置くもの（退室ボタン・設定ボタン・「管理者」表示など） */
  actions?: ReactNode;
  logoHref?: string;
  className?: string;
};

/** 全画面共通のナビゲーション（左にロゴ、右に操作） */
export function AppHeader({ actions, logoHref, className }: AppHeaderProps) {
  return (
    <nav
      className={cn(
        // スクロールしてもロゴ・操作に届くよう上部に固定。背景と同じ色にして、下に線を引いて区切る
        "sticky top-0 z-20 flex h-[68px] shrink-0 items-center justify-between border-b border-line bg-paper px-5 md:h-[88px] md:px-12",
        className,
      )}
    >
      <Logo href={logoHref} />
      {actions && <div className="flex items-center gap-4">{actions}</div>}
    </nav>
  );
}
