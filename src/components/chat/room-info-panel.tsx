import { File, NotebookPen } from "lucide-react";
import type { Member } from "@/lib/types";
import { InitialAvatar } from "@/components/common/initial-avatar";

type RoomInfoPanelProps = {
  participants: Member[];
  myId: string;
  isAdmin: boolean;
  membersLabel: string;
};

/** 参加者一覧と共有スペース（PCは右サイドバー、スマホはシートの中身） */
export function RoomInfoPanel({ participants, myId, isAdmin, membersLabel }: RoomInfoPanelProps) {
  return (
    <div className="space-y-5 text-ink">
      <section>
        <h2 className="mb-4 text-sm font-medium">参加者　{membersLabel}</h2>
        <ul className="space-y-4">
          {participants.map((p) => {
            const isMe = p.guestId === myId;
            return (
              <li key={p.guestId} className="flex items-center gap-3">
                <InitialAvatar name={p.nickname} />
                <div className="min-w-0">
                  <p className="truncate text-[13px]">
                    {p.nickname}
                    {isMe && "（あなた）"}
                  </p>
                  {/* 管理者かどうかは、サーバーと結合したら参加者ごとに受け取る */}
                  <p className="text-[10px] text-ink-muted">{isMe && isAdmin ? "管理者" : "参加中"}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <hr className="border-line" />

      <section>
        <h2 className="mb-3 text-[13px] font-medium">この雲の共有スペース</h2>
        {/* 消えるノート・ファイル共有（F-13 / F-14）を実装したら、ここに一覧を出す */}
        <div className="space-y-2.5 text-xs text-ink-muted">
          <p className="flex items-center gap-2.5 rounded-xl bg-cloud-pale px-3 py-3">
            <NotebookPen className="size-[18px] shrink-0 text-ink" />
            ノートはまだありません
          </p>
          <p className="flex items-center gap-2.5 px-3 py-1">
            <File className="size-[18px] shrink-0 text-ink" />
            ファイルはまだありません
          </p>
        </div>
      </section>

      <hr className="border-line" />

      <p className="text-[11px] leading-relaxed text-ink-muted">
        期限がくると、会話・ノート・ファイルは、この雲と一緒に消えます。
      </p>
    </div>
  );
}
