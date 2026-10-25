import { Timer } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatExpiryDate, formatTime } from "@/lib/format";
import { isSameDay } from "@/components/common/format";

type ExpiryDateProps = {
  /** ルームが消える時刻（epoch ms）。読み込み前は undefined */
  expiresAt?: number;
  /** 「今日」の判定に使う現在時刻 */
  now: number;
  className?: string;
};

/**
 * 「このチャットは 10月27日(火) 23:59 に消えます」の1行表示。
 * 要件どおり残り時間（カウントダウン）ではなく日時で出す。
 * チャット画面のルーム情報で使う。スマホでは幅をとらないよう「10/27(火) 23:59 に消えます」に縮める
 */
export function ExpiryDate({ expiresAt, now, className }: ExpiryDateProps) {
  const today = expiresAt && isSameDay(expiresAt, now) ? "今日 " : "";
  const time = expiresAt ? ` ${formatTime(expiresAt)}` : "";

  return (
    <p className={cn("flex items-center gap-1 text-xs whitespace-nowrap text-ink-muted", className)}>
      <Timer className="size-3.5 shrink-0" aria-hidden />
      {expiresAt ? (
        <>
          <span className="hidden sm:inline">このチャットは</span>
          <time
            dateTime={new Date(expiresAt).toISOString()}
            className="font-bold tabular-nums text-ink"
          >
            <span className="sm:hidden">{today + formatExpiryDate(expiresAt, "short") + time}</span>
            <span className="hidden sm:inline">{today + formatExpiryDate(expiresAt, "long") + time}</span>
          </time>
          に消えます
        </>
      ) : (
        "--"
      )}
    </p>
  );
}
