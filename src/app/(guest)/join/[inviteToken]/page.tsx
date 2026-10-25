import type { Metadata } from "next";
import { Info } from "lucide-react";
import { CloudBubble } from "@/components/brand/cloud-bubble";
import { PageShell } from "@/components/layout/page-shell";
import type { RoomPreview } from "@/types/room";
import { JoinForm } from "./_components/join-form";
import { RoomStatus } from "./_components/room-status";

export const metadata: Metadata = { title: "トークルームに入室" };

function isRoomPreview(value: unknown): value is RoomPreview {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { id?: unknown }).id === "string" &&
    typeof (value as { name?: unknown }).name === "string"
  );
}

type InviteRow = {
  id: string;
  name: string;
  expires_at?: string;
  max_members?: number | null;
  member_count?: number;
};

async function getRoomPreview(inviteToken: string): Promise<RoomPreview | null> {
  const { createHash } = await import("node:crypto");
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const tokenHash = createHash("sha256").update(inviteToken).digest("hex");
  const { data } = await supabase
    .rpc("get_room_by_invite", { p_token_hash: tokenHash })
    .maybeSingle();
  if (!isRoomPreview(data)) return null;
  const row = data as InviteRow;
  return {
    id: row.id,
    name: row.name,
    expiresAt: row.expires_at ? Date.parse(row.expires_at) : undefined,
    maxMembers: row.max_members,
    memberCount: row.member_count,
  };
}

/**
 * 残り時間のカウントダウンの起点（サーバーで描いた時刻）。
 * Date.now() はコンポーネント本体で呼ぶと react-hooks/purity に引っかかるので、ここで呼ぶ
 */
async function getNow() {
  return Date.now();
}

/** 左側の「ようこそ」の挿絵（雲と太陽） */
function Welcome() {
  return (
    <section className="relative flex flex-col overflow-hidden rounded-3xl bg-cloud-pale p-8 md:min-h-[600px] md:p-10">
      <h2 className="text-2xl leading-snug font-bold md:text-[34px]">
        招待された雲へ、
        <br />
        ようこそ。
      </h2>
      <p className="mt-6 text-sm leading-relaxed text-ink-muted">
        アカウントは、いりません。
        <br />
        名前だけで、会話の輪の中へ。
      </p>

      <div aria-hidden className="relative mt-10 hidden flex-1 md:block">
        <span className="absolute right-[2%] bottom-[34%] size-[34%] max-w-36 rounded-full bg-sun" />
        <span className="absolute right-[10%] bottom-[18%] size-2 rounded-full bg-cloud/70" />
        <span className="absolute right-[15%] bottom-[11%] size-3.5 rounded-full bg-cloud/70" />
        <div className="absolute bottom-0 left-0 w-[80%]">
          <CloudBubble />
          <p className="absolute inset-x-0 top-[48%] text-center text-sm text-ink">
            また、ここで話そう。
          </p>
        </div>
      </div>
    </section>
  );
}

export default async function JoinPage({
  params,
}: PageProps<"/join/[inviteToken]">) {
  const { inviteToken } = await params;
  const room = await getRoomPreview(inviteToken);
  const now = await getNow();

  return (
    <PageShell
      actions={
        <p className="hidden text-xs text-ink-muted sm:block">招待された方のための、小さな空間</p>
      }
      footer
    >
      <main className="mx-auto grid w-full max-w-6xl flex-1 gap-10 px-5 py-8 md:grid-cols-2 md:items-center md:gap-16 md:px-12 md:py-14">
        <Welcome />

        <section className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <p className="text-xs text-cloud-deep">ログイン不要で参加できます</p>
            <h1 className="text-xl leading-snug font-bold break-all md:text-[28px]">
              {room ? (
                <>
                  {room.name}の
                  <br />
                  トークルームに入室します
                </>
              ) : (
                "このルームには入室できません"
              )}
            </h1>
          </div>

          {room ? (
            <>
              {room.expiresAt !== undefined && (
                <RoomStatus
                  expiresAt={room.expiresAt}
                  initialNow={now}
                  memberCount={room.memberCount}
                  maxMembers={room.maxMembers}
                />
              )}
              <JoinForm inviteToken={inviteToken} />
            </>
          ) : (
            <p className="rounded-xl bg-cloud-pale p-5 text-sm leading-relaxed text-ink-muted">
              招待URLの期限が切れているか、ルームがすでに消えています。管理者に新しい招待URLをもらってください。
            </p>
          )}

          <p className="flex gap-2.5 rounded-xl bg-sun px-5 py-4 text-xs leading-relaxed text-ink-muted">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
            期限がくると、会話・ノート・ファイルは消えます。必要な情報は、期限までに控えておきましょう。
          </p>
        </section>
      </main>
    </PageShell>
  );
}
