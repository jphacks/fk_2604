import Link from "next/link";
import { ArrowLeft, Settings, Users } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { ExpiryDate } from "@/components/room/expiry-date";
import { cn } from "@/lib/utils";

type RoomHeaderProps = {
  roomId: string;
  roomName: string;
  isAdmin: boolean;
  /** 「4人　はる・ゆい・けん・あおい」（スマホ・タブレットで表示） */
  membersSummary: string;
  expiresAt?: number;
  now: number;
  /** スマホで参加者シートを開く */
  onOpenMembers: () => void;
};

/** チャット画面のルームヘッダー（ルーム名・参加者・消える日・管理者の操作） */
export function RoomHeader({
  roomId,
  roomName,
  isAdmin,
  membersSummary,
  expiresAt,
  now,
  onOpenMembers,
}: RoomHeaderProps) {
  return (
    <header className="shrink-0 border-y border-line bg-card px-5 pt-3 pb-4 md:px-10 md:py-7">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between md:gap-6">
        <div className="min-w-0">
          {isAdmin && (
            <Link
              href="/dashboard"
              className="mb-2 hidden items-center gap-1.5 text-sm font-medium hover:opacity-70 md:inline-flex"
            >
              <ArrowLeft className="size-4" />
              メインへ戻る
            </Link>
          )}
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Link href="/dashboard" aria-label="メインへ戻る" className="md:hidden">
                <ArrowLeft className="size-5" />
              </Link>
            )}
            <h1 className="truncate text-[21px] font-medium md:text-[23px]">{roomName}</h1>
          </div>
          <button
            type="button"
            onClick={onOpenMembers}
            className="mt-2 flex w-full items-center gap-2 text-left text-xs text-ink-muted lg:hidden"
          >
            <span className="truncate">{membersSummary}</span>
            <Users className="ml-auto size-4 shrink-0 text-ink" aria-label="参加者を見る" />
          </button>
        </div>

        <div className="flex items-center gap-3 md:gap-4">
          <ExpiryDate
            expiresAt={expiresAt}
            now={now}
            className="flex flex-1 items-center justify-between gap-3 rounded-xl bg-cloud-pale px-4 py-2.5 md:block md:flex-none md:bg-transparent md:p-0 md:text-right"
            labelClassName="shrink-0"
            dateClassName="text-right text-xl sm:text-2xl md:text-[28px] md:leading-tight"
          />
          {isAdmin && (
            <Link
              href={`/rooms/${roomId}/settings`}
              className={cn(
                buttonVariants({ variant: "outline" }),
                "h-[50px] gap-2.5 rounded-xl bg-card px-4 md:px-6",
              )}
            >
              <Settings className="size-[18px]" />
              <span className="hidden sm:inline">ルーム設定</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
