import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type ShareButtonProps = {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  /** スマホの「＋」メニュー用の大きいボタン */
  size?: "chip" | "large";
};

/** 共有メニューのボタン（消えるノート / ファイル共有） */
export function ShareButton({ icon: Icon, label, onClick, size = "chip" }: ShareButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center justify-center gap-2 bg-cloud-pale text-xs text-ink transition hover:bg-cloud-soft",
        size === "large" ? "h-10 rounded-xl" : "h-[27px] rounded-full px-3",
      )}
    >
      <Icon className={size === "large" ? "size-[17px]" : "size-[15px]"} />
      {label}
    </button>
  );
}
