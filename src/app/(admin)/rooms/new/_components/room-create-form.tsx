"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Info, Plus } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { ja } from "react-day-picker/locale";

import { Button, buttonVariants } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  countDays,
  formatMonthDay,
  MAX_ROOM_DAYS,
  toDateString,
} from "@/lib/room-period";
import { createRoom, type CreateRoomState } from "../actions";
import { ROOM_NAME_MAX_LENGTH } from "../constants";
import { ShareUrlDialog } from "./share-url-dialog";

const initialState: CreateRoomState = {};

export function RoomCreateForm() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(createRoom, initialState);
  const [range, setRange] = useState<DateRange | undefined>();

  const startDate = range?.from ? toDateString(range.from) : "";
  // 1日だけのルームは開始日のクリックだけで選べるようにする
  const endDate = range?.to ? toDateString(range.to) : startDate;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // 開始日を選んだあとは、最大日数を超える日を選べなくする
  const latestEnd =
    range?.from && !range.to
      ? new Date(range.from.getFullYear(), range.from.getMonth(), range.from.getDate() + MAX_ROOM_DAYS - 1)
      : undefined;

  return (
    <>
      <form
        action={formAction}
        noValidate
        className="mt-8 flex flex-col gap-6 rounded-3xl bg-card p-6 ring-1 ring-line md:p-8"
      >
        <div className="flex flex-col gap-2">
          <label htmlFor="name" className="text-sm font-bold">
            ルーム名
          </label>
          <Input
            id="name"
            name="name"
            placeholder="例: 秋季大会 応援グループ"
            maxLength={ROOM_NAME_MAX_LENGTH}
            defaultValue={state.fields?.name}
            aria-invalid={!!state.errors?.name}
            aria-describedby={state.errors?.name ? "name-error" : undefined}
            required
            className="h-12 rounded-xl px-4"
          />
          {state.errors?.name && (
            <p id="name-error" className="text-sm text-destructive">
              {state.errors.name}
            </p>
          )}
        </div>

        <fieldset className="flex flex-col gap-2" aria-describedby="period-summary">
          <legend className="mb-2 text-sm font-bold">利用期間</legend>
          <p className="text-xs text-ink-muted">
            開始日と終了日をクリックして選んでください（最大{MAX_ROOM_DAYS}日）。
            <br />
            終了日の23:59にルームは消えます
          </p>
          <Calendar
            mode="range"
            locale={ja}
            selected={range}
            onSelect={setRange}
            resetOnSelect
            disabled={[{ before: today }, ...(latestEnd ? [{ after: latestEnd }] : [])]}
            // 日付を押しやすいよう、この画面だけマスを大きくする（標準は --spacing(7)）
            className="mx-auto rounded-xl border p-3 [--cell-size:--spacing(9)]! md:[--cell-size:--spacing(11)]!"
          />
          <input type="hidden" name="startDate" value={startDate} />
          <input type="hidden" name="endDate" value={endDate} />
          <p id="period-summary" aria-live="polite" className="text-sm font-bold">
            {startDate
              ? `${formatMonthDay(startDate)}〜${formatMonthDay(endDate)}（${countDays(startDate, endDate)}日間）`
              : "未選択"}
          </p>
          {state.errors?.period && (
            <p className="text-sm text-destructive">{state.errors.period}</p>
          )}
        </fieldset>

        <hr className="border-line" />

        <p className="flex gap-2.5 rounded-xl bg-sun px-5 py-4 text-xs leading-relaxed text-ink-muted">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          作成すると、招待URLが表示されます。期限がくると、会話・ファイルはすべて消えます。
        </p>

        {/* 入力は正しいが、ルームの作成や招待URLの発行に失敗したとき */}
        {state.message && (
          <p role="alert" className="text-sm text-destructive">
            {state.message}
          </p>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/dashboard"
            className={cn(buttonVariants({ variant: "outline" }), "h-12 rounded-xl bg-card text-sm font-bold")}
          >
            キャンセル
          </Link>
          <Button type="submit" disabled={pending} className="h-12 gap-2 rounded-xl text-sm font-bold">
            <Plus aria-hidden />
            {pending ? "作成中…" : "ルームを作成する"}
          </Button>
        </div>
      </form>

      {state.created && (
        <ShareUrlDialog
          inviteUrl={state.created.inviteUrl}
          // 管理者もゲストと同じ入室画面でニックネームを入れてからチャットへ入る
          onClose={() => router.push(`/join/${state.created!.inviteToken}`)}
        />
      )}
    </>
  );
}
