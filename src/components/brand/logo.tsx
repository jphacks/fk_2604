import Link from "next/link";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";
import { CloudIcon } from "./cloud-icon";

type LogoProps = {
  /** 指定するとロゴがリンクになる（例：管理者はダッシュボードへ） */
  href?: string;
  className?: string;
  /** true にすると雲のアイコンだけを出す（サービス名は読み上げ用に残す） */
  iconOnly?: boolean;
};

/** 雲のアイコン＋サービス名。全画面のナビゲーションで使う */
export function Logo({ href, className, iconOnly = false }: LogoProps) {
  const content = (
    <>
      <CloudIcon className="md:h-[27px] md:w-[39px]" />
      <span
        className={cn(
          "text-[21px] font-bold tracking-wide text-ink md:text-[25px]",
          iconOnly && "sr-only",
        )}
      >
        {siteConfig.name}
      </span>
    </>
  );
  const style = cn("flex items-center gap-2.5", className);

  return href ? (
    <Link href={href} className={style} aria-label={`${siteConfig.name} トップへ`}>
      {content}
    </Link>
  ) : (
    <div className={style}>{content}</div>
  );
}
