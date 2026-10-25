import type { Message } from "@/lib/types";
import { cn } from "@/lib/utils";
import { formatTime } from "@/lib/format";
import { InitialAvatar } from "@/components/common/initial-avatar";

type MessageItemProps = {
  message: Message;
  /** 自分の発言なら右側・水色の吹き出し */
  isMine: boolean;
};

/** メッセージ1件（名前と時刻 ＋ 吹き出し） */
export function MessageItem({ message, isMine }: MessageItemProps) {
  return (
    <div className={cn("mb-4 flex gap-2.5", isMine && "justify-end")}>
      {!isMine && <InitialAvatar name={message.nickname} />}
      <div className={cn("flex max-w-[85%] min-w-0 flex-col md:max-w-[60%]", isMine && "items-end")}>
        <p className="mb-1 text-[11px] text-ink-muted">
          {message.nickname}
          {isMine && "（あなた）"}
          <time className="ml-3" dateTime={new Date(message.sentAt).toISOString()}>
            {formatTime(message.sentAt)}
          </time>
        </p>
        <p
          className={cn(
            "rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed whitespace-pre-wrap break-words md:text-sm",
            isMine ? "rounded-tr-md bg-cloud" : "rounded-tl-md border border-line bg-card",
          )}
        >
          {message.body}
        </p>
      </div>
    </div>
  );
}
