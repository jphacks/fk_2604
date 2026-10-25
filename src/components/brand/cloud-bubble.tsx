import { useId } from "react";
import { cn } from "@/lib/utils";

const CLOUD_PATH =
  "M160 466C60 466 0 420 0 340C0 270 50 218 117 215C110 120 160 68 235 68C248 68 258 70 266 73C300 25 345 0 390 0C445 0 492 30 516 80C540 70 560 65 585 65C655 65 711 120 711 193C720 190 730 190 745 190C815 190 870 245 870 330C870 410 820 466 700 466L300 466L215 527L232 466Z";

/**
 * 吹き出しの形をした雲（左下にしっぽ）。ダッシュボードのルームや入室画面の挿絵に使う。
 * 色は text-cloud などの文字色で決まる。縦横比は 870:527
 *
 * outline を付けると、白いふちどりを少しぼかして描く（空の背景の上で雲が背景に溶けないようにするため）。
 * 白い線をぼかしたものを下に敷き、その上に雲を重ねるので、外側にだけふんわりした白が見える
 */
export function CloudBubble({
  className,
  outline = false,
}: {
  className?: string;
  outline?: boolean;
}) {
  // ぼかしのフィルターは id で指定するので、雲ごとに別の id にする
  const blurId = useId();

  return (
    <svg
      viewBox="0 0 870 527"
      fill="currentColor"
      aria-hidden
      className={cn("block w-full overflow-visible text-cloud", className)}
    >
      {outline && (
        <>
          <defs>
            {/* ぼかしが広がる分、フィルターの範囲も広げておく（狭いと端で切れる） */}
            <filter id={blurId} x="-15%" y="-20%" width="130%" height="140%">
              {/* ぼかしの強さ。大きくするほど、ふちがやわらかく広がる */}
              <feGaussianBlur stdDeviation="8" />
            </filter>
          </defs>
          {/* 白が目立ちすぎないよう、半透明にして空になじませる */}
          <path
            d={CLOUD_PATH}
            fill="white"
            stroke="white"
            strokeWidth={18}
            strokeLinejoin="round"
            opacity={0.85}
            filter={`url(#${blurId})`}
          />
        </>
      )}
      <path d={CLOUD_PATH} />
    </svg>
  );
}
