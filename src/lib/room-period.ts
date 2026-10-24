/**
 * ルームの利用期間（日付範囲）のルール。
 * 新規ルーム作成・ルーム設定・チャット画面の期限延長で共通して使う。
 * 日付は "YYYY-MM-DD"（日本時間の暦日）の文字列で扱う。
 */

export const MAX_ROOM_DAYS = 31;

const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isValidDateString(date: string) {
  return DATE_PATTERN.test(date) && !Number.isNaN(Date.parse(`${date}T00:00:00Z`));
}

/** Date をその環境のローカル日付で "YYYY-MM-DD" にする（カレンダーの選択値の変換用） */
export function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** 日本時間の今日 */
export function todayJst(now = Date.now()): string {
  return new Date(now + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** 次の 0:00 JST の epoch ms。招待URLはこの時刻に更新される */
export function nextMidnightJst(now = Date.now()): number {
  return Date.parse(`${todayJst(now)}T00:00:00+09:00`) + DAY_MS;
}

/** 開始日・終了日を含めた日数（10/26〜10/28 なら 3） */
export function countDays(startDate: string, endDate: string): number {
  return (Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / DAY_MS + 1;
}

/** その日の終わり（23:59:59.999 JST）の epoch ms。ルームはこの時刻に消える */
export function endOfDayJst(date: string): number {
  return Date.parse(`${date}T23:59:59.999+09:00`);
}

/** "10月26日" の形式 */
export function formatMonthDay(date: string): string {
  const [, m, d] = date.split("-").map(Number);
  return `${m}月${d}日`;
}

export function validateRoomPeriod(startDate: string, endDate: string): string | undefined {
  if (!startDate || !endDate) return "利用期間の開始日と終了日を選んでください";
  if (!isValidDateString(startDate) || !isValidDateString(endDate)) {
    return "利用期間の日付が正しくありません";
  }
  if (startDate < todayJst()) return "開始日には今日以降の日付を選んでください";
  if (endDate < startDate) return "終了日は開始日以降の日付を選んでください";
  if (countDays(startDate, endDate) > MAX_ROOM_DAYS) {
    return `利用期間は最大${MAX_ROOM_DAYS}日までです`;
  }
}
