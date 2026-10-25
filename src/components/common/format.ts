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

/** ルームの残り時間：1日以上は日数だけ「2日」（切り捨て）、1日未満は「03:24:18」 */
export function formatCountdown(remainingMs: number) {
  const s = Math.max(0, Math.floor(remainingMs / 1000));
  const d = Math.floor(s / 86400);
  const pad = (n: number) => String(n).padStart(2, "0");
  if (d >= 1) return `${d}日`;
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

