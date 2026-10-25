import { cn } from "@/lib/utils";

/** くもとーくの雲のシルエット。色は text-cloud などの文字色で決まる */
export function CloudIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 22"
      fill="currentColor"
      aria-hidden
      className={cn("h-[22px] w-8 text-cloud", className)}
    >
      <path d="M8.5 22A7.5 7.5 0 0 1 7.4 7.1 9 9 0 0 1 24.2 6a8 8 0 0 1 .3 16Z" />
    </svg>
  );
}
