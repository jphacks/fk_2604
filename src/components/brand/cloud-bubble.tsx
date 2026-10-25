import { cn } from "@/lib/utils";

/**
 * 吹き出しの形をした雲（左下にしっぽ）。ダッシュボードのルームや入室画面の挿絵に使う。
 * 色は text-cloud などの文字色で決まる。縦横比は 870:527
 */
export function CloudBubble({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 870 527"
      fill="currentColor"
      aria-hidden
      className={cn("block w-full text-cloud", className)}
    >
      <path d="M160 466C60 466 0 420 0 340C0 270 50 218 117 215C110 120 160 68 235 68C248 68 258 70 266 73C300 25 345 0 390 0C445 0 492 30 516 80C540 70 560 65 585 65C655 65 711 120 711 193C720 190 730 190 745 190C815 190 870 245 870 330C870 410 820 466 700 466L300 466L215 527L232 466Z" />
    </svg>
  );
}
