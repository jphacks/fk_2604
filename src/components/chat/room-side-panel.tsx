"use client";

import { useState } from "react";
import { formatMembers } from "@/components/common/format";
import { InitialAvatar } from "@/components/common/initial-avatar";
import type { Member, SharedFile } from "@/lib/types";
import { cn } from "@/lib/utils";
import { FilePreview } from "./file-preview";
import { SharedFiles } from "./shared-files";

export type SidePanelTab = "members" | "files";

/**
 * チャット画面右側のパネル（Figma S-09）。「参加者」「共有ファイル」をタブで切り替える。
 * PCは右の欄、スマホは下から出るシートの中で使う
 */
export function RoomSidePanel({
  tab,
  onTabChange,
  participants,
  me,
  isOwner,
  memberCount,
  maxMembers,
  files,
  roomId,
}: {
  tab: SidePanelTab;
  onTabChange: (tab: SidePanelTab) => void;
  /** 自分を先頭にした参加者 */
  participants: Member[];
  me: Member;
  isOwner: boolean;
  memberCount: number;
  maxMembers?: number | null;
  files: SharedFile[];
  roomId: string;
}) {
  const [selectedId, setSelectedId] = useState<string>();
  // 選んだファイルが消えた・まだ選んでいないときは、最新のファイルを見せる
  const selected = files.find((f) => f.id === selectedId) ?? files.at(-1);

  const tabs: { id: SidePanelTab; label: string; count: string }[] = [
    { id: "members", label: "参加者", count: formatMembers(memberCount, maxMembers) },
    { id: "files", label: "共有ファイル", count: `${files.length}件` },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div role="tablist" aria-label="参加者と共有ファイル" className="flex gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => onTabChange(t.id)}
            className={cn(
              "rounded-full border px-4 py-1.5 text-xs font-medium transition",
              tab === t.id
                ? "border-cloud bg-cloud text-ink"
                : "border-line bg-card text-ink-muted hover:bg-cloud-pale",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "members" ? (
        <Card title="参加者" count={tabs[0].count} className="flex-1">
          <ul className="space-y-1">
            {participants.map((p) => {
              const isMe = p.guestId === me.guestId;
              return (
                <li key={p.guestId} className="flex items-center gap-3 py-1.5">
                  <InitialAvatar name={p.nickname} className="size-9" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm">
                      {p.nickname}
                      {isMe && <span className="text-ink-muted">（あなた）</span>}
                    </span>
                    <span className="block text-[11px] text-ink-muted">
                      {isMe && isOwner ? "管理者" : "参加中"}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>
      ) : (
        <>
          <Card title="共有ファイル" count={tabs[1].count} className="max-h-[45%] shrink-0">
            <SharedFiles
              files={files}
              roomId={roomId}
              guestId={me.guestId}
              selectedId={selected?.id}
              onSelect={setSelectedId}
            />
          </Card>
          {selected && (
            <Card title="ファイルプレビュー" className="min-h-72 flex-1">
              <FilePreview
                key={selected.id}
                file={selected}
                roomId={roomId}
                guestId={me.guestId}
              />
            </Card>
          )}
        </>
      )}

      <p className="shrink-0 text-[11px] leading-relaxed text-ink-muted">
        期限がくると、会話・ファイルは、この雲と一緒に消えます。
      </p>
    </div>
  );
}

/** パネル内の枠（見出し＋件数＋中身）。中身が多いときは枠の中だけスクロールする */
function Card({
  title,
  count,
  className,
  children,
}: {
  title: string;
  count?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "flex min-h-0 flex-col overflow-hidden rounded-2xl border border-line bg-card",
        className,
      )}
    >
      <header className="flex shrink-0 items-center justify-between border-b border-line px-4 py-2.5">
        <h2 className="text-sm font-semibold">{title}</h2>
        {count && <span className="text-xs text-ink-muted tabular-nums">{count}</span>}
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">{children}</div>
    </section>
  );
}
