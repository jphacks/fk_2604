import Link from "next/link";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";
import { CloudIcon } from "./cloud-icon";

type LogoProps = {
  /** 指定するとロゴがリンクになる（例：管理者はダッシュボードへ） */
  href?: string;
  className?: string;
  /**
   * true にすると小さめのロゴにする（チャット画面の 60px のヘッダーに収めるため）。
   * スマホはルーム名の幅を空けるため、アイコンだけにする（サービス名は読み上げ用に残す）
   */
  compact?: boolean;
};

/** 雲のアイコン＋サービス名。全画面のナビゲーションで使う */
export function Logo({ href, className, compact = false }: LogoProps) {
  const content = (
    <>
      <CloudIcon className={compact ? undefined : "md:h-[27px] md:w-[39px]"} />
      <span
        className={cn(
          "font-bold tracking-wide text-ink",
          compact
            ? "max-sm:sr-only text-[18px]"
            : "text-[21px] md:text-[25px]",
        )}
      >
        {siteConfig.name}
      </span>
    </>
  );
  const style = cn("flex items-center", compact ? "gap-2" : "gap-2.5", className);

  return href ? (
    <Link href={href} className={style} aria-label={`${siteConfig.name} トップへ`}>
      {content}
    </Link>
  ) : (
    <div className={style}>{content}</div>
  );
}
