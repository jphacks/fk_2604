import { formatExpiryDate } from "@/lib/format";

/**
 * 画面表示のための小さな整形関数（UI専用）。
 * 時刻・日付そのものの整形は lib/format.ts（formatTime / formatExpiryDate）を使う。
 */

const DAY_MS = 86_400_000;

/** 2つの時刻が同じ日かどうか */
export function isSameDay(a: number, b: number) {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

/** メッセージ一覧の日付区切り：「今日　10月24日(土)」「昨日　…」 */
export function formatDayLabel(ms: number, now: number) {
  const date = formatExpiryDate(ms, "long");
  if (isSameDay(ms, now)) return `今日　${date}`;
  if (isSameDay(ms, now - DAY_MS)) return `昨日　${date}`;
  return date;
}

/** 上限なしなら「4人」、上限ありなら「4 / 10人」 */
export function formatMembers(count: number, max?: number | null) {
  return max ? `${count} / ${max}人` : `${count}人`;
}
