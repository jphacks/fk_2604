import { cn } from "@/lib/utils";

/** 名前の頭文字が入った丸いアイコン（チャット・参加者一覧・ユーザー設定で使う） */
export function InitialAvatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-[34px] shrink-0 items-center justify-center rounded-full bg-cloud-soft text-xs font-medium text-ink",
        className,
      )}
    >
      {name.slice(0, 1)}
    </span>
  );
}
