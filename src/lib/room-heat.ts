/**
 * ルームの「盛り上がり」（ダッシュボードの雲の大きさ）を計算するルール。
 * 計算はこのファイルだけに集める。数値を変えたいときは下の定数を調整する。
 *
 * 方式：減衰スコア
 * - メッセージが1件届くたびに点数 +1
 * - 何もなければ、半減期（HEAT_HALF_LIFE_MS）ごとに点数が半分になる
 *     今の点数 = 前の点数 × 0.5^(経過時間 ÷ 半減期) + 1
 * - 保存するのは { score, updatedAt } の2つだけ。
 *   「今の点数」は読むたびに経過時間から計算し直す（定期的に減らす処理はいらない）
 *
 * 保存場所
 * - Redis の chat:room:{roomId}:heat に、ルームと同じ期限で保存する（lib/redis-messages.ts）
 *   （ルームが消えると点数も一緒に消える）
 *
 * React や Next.js には依存しない、純粋な関数だけを置くこと。
 */

/** 点数が半分になるまでの時間（ミリ秒）。デモ時は5分などに短くする */
export const HEAT_HALF_LIFE_MS = 30 * 60 * 1000;

/** 雲の大きさが切り替わる点数（md 以上で中、それ未満は小） */
export const HEAT_THRESHOLDS = { md: 3 } as const;

/** 保存する盛り上がりの情報。updatedAt は最後に加点した時刻（epoch ms） */
export type RoomHeat = { score: number; updatedAt: number };

/** 雲の大きさ */
export type CloudSize = "sm" | "md";

/** /api/rooms/heat の返り値。now はサーバーの現在時刻（時計のずれの補正に使う） */
export type RoomHeatsResponse = {
  heats: Record<string, RoomHeat | null>;
  now: number;
};

/** 時刻 now の時点の点数。まだ点数がなければ 0 */
export function currentScore(heat: RoomHeat | null | undefined, now: number): number {
  if (!heat) return 0;
  // 時計のずれで未来の時刻が入っていても、増えないように 0 にそろえる
  const elapsed = Math.max(0, now - heat.updatedAt);
  return heat.score * 0.5 ** (elapsed / HEAT_HALF_LIFE_MS);
}

/** 点数を加える（メッセージ1件で +1）。減衰させてから足し、時刻を now に進める */
export function addHeat(
  heat: RoomHeat | null | undefined,
  now: number,
  points = 1,
): RoomHeat {
  return { score: currentScore(heat, now) + points, updatedAt: now };
}

/** 点数から雲の大きさを決める */
export function cloudSizeFromScore(score: number): CloudSize {
  if (score >= HEAT_THRESHOLDS.md) return "md";
  return "sm";
}
