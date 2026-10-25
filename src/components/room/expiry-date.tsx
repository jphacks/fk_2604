import { cn } from "@/lib/utils";
import { formatExpiryDate } from "@/lib/format";
import { isSameDay } from "@/components/common/format";

type ExpiryDateProps = {
  /** ルームが消える時刻（epoch ms）。読み込み前は undefined */
  expiresAt?: number;
  /** 「今日」の判定に使う現在時刻 */
  now: number;
  className?: string;
  labelClassName?: string;
  dateClassName?: string;
};

/**
 * 「このチャットは　10月27日（火）に消えます」の表示。
 * 要件どおり残り時間（カウントダウン）ではなく日付で出す。
 * チャット画面のヘッダー、ダッシュボードのルームカードなどで使う。
 */
export function ExpiryDate({
  expiresAt,
  now,
  className,
  labelClassName,
  dateClassName,
}: ExpiryDateProps) {
  const label = expiresAt
    ? `${isSameDay(expiresAt, now) ? "今日 " : ""}${formatExpiryDate(expiresAt, "long")}`
    : "--";

  return (
    <div className={className}>
      <p className={cn("text-[11px] text-ink-muted", labelClassName)}>このチャットは</p>
      <p className={cn("font-medium tabular-nums text-ink", dateClassName)}>
        {expiresAt ? <time dateTime={new Date(expiresAt).toISOString()}>{label}</time> : label}
        {/* 日付を目立たせたいので、続きの文は小さく控えめにする */}
        {expiresAt && <span className="ml-1 text-sm font-normal text-ink-muted">に消えます</span>}
      </p>
    </div>
  );
}
