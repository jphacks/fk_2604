import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { AppHeader } from "./app-header";
import { SiteFooter } from "./site-footer";

type PageShellProps = {
  children: ReactNode;
  /** AppHeader にそのまま渡す */
  actions?: ReactNode;
  logoHref?: string;
  logoCompact?: boolean;
  headerCenter?: ReactNode;
  className?: string;
  /** ヘッダーの見た目を画面ごとに変えたいとき（例：チャット画面は高さを詰める） */
  headerClassName?: string;
  /** ページ下にフッターを出す（チャット画面のように全画面を使う画面では出さない） */
  footer?: boolean;
};

/** 全画面共通の外枠（単色の背景＋上部固定のヘッダー）。背景・ヘッダーの色はここで統一する */
export function PageShell({
  children,
  actions,
  logoHref,
  logoCompact,
  headerCenter,
  className,
  headerClassName,
  footer = false,
}: PageShellProps) {
  return (
    <div className={cn("flex min-h-dvh flex-col bg-paper text-ink", className)}>
      <AppHeader
        logoHref={logoHref}
        logoCompact={logoCompact}
        center={headerCenter}
        actions={actions}
        className={headerClassName}
      />
      {children}
      {footer && <SiteFooter />}
    </div>
  );
}
