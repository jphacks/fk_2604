import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/brand/logo";

type AppHeaderProps = {
  /** 右側に置くもの（退室ボタン・設定ボタン・「管理者」表示など） */
  actions?: ReactNode;
  logoHref?: string;
  /** ロゴを小さめにする（チャット画面など、ヘッダーを詰めたいとき） */
  logoCompact?: boolean;
  /** 中央に置くもの（チャット画面のルーム名など）。指定するとロゴ／中央／操作の3列になる */
  center?: ReactNode;
  className?: string;
};

/** 全画面共通のナビゲーション（左にロゴ、右に操作） */
export function AppHeader({
  actions,
  logoHref,
  logoCompact,
  center,
  className,
}: AppHeaderProps) {
  return (
    <nav
      className={cn(
        // スクロールしてもロゴ・操作に届くよう上部に固定。背景と同じ色にして、下に線を引いて区切る
        "sticky top-0 z-20 flex h-[68px] shrink-0 items-center justify-between gap-3 border-b border-line bg-paper px-5 md:h-[88px] md:px-12",
        // 中央に何か置くときは、左右の列を同じ幅にして中央を画面のまん中にそろえる
        center && "grid grid-cols-[auto_minmax(0,1fr)_auto] md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,1fr)]",
        className,
      )}
    >
      <Logo href={logoHref} compact={logoCompact} />
      {center && <div className="min-w-0 text-center">{center}</div>}
      {actions && (
        <div className="flex items-center gap-4 justify-self-end">{actions}</div>
      )}
    </nav>
  );
}
