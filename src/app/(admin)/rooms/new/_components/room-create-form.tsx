"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import type { DateRange } from "react-day-picker";
import { ja } from "react-day-picker/locale";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
      <form action={formAction} noValidate>
        <CardContent className="flex flex-col gap-5 pb-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="name" className="text-sm font-medium">
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
            />
            {state.errors?.name && (
              <p id="name-error" className="text-sm text-destructive">
                {state.errors.name}
              </p>
            )}
          </div>

          <fieldset className="flex flex-col gap-1.5" aria-describedby="period-summary">
            <legend className="mb-1.5 text-sm font-medium">利用期間</legend>
            <p className="text-xs text-muted-foreground">
              開始日と終了日をクリックして選んでください（最大{MAX_ROOM_DAYS}日）。終了日の23:59にルームは消えます
            </p>
            <Calendar
              mode="range"
              locale={ja}
              selected={range}
              onSelect={setRange}
              resetOnSelect
              disabled={[{ before: today }, ...(latestEnd ? [{ after: latestEnd }] : [])]}
              className="mx-auto rounded-lg border"
            />
            <input type="hidden" name="startDate" value={startDate} />
            <input type="hidden" name="endDate" value={endDate} />
            <p id="period-summary" aria-live="polite" className="text-sm">
              {startDate
                ? `${formatMonthDay(startDate)}〜${formatMonthDay(endDate)}（${countDays(startDate, endDate)}日間）`
                : "未選択"}
            </p>
            {state.errors?.period && (
              <p className="text-sm text-destructive">{state.errors.period}</p>
            )}
          </fieldset>

          {/* 入力は正しいが、ルームの作成や招待URLの発行に失敗したとき */}
          {state.message && (
            <p role="alert" className="text-sm text-destructive">
              {state.message}
            </p>
          )}
        </CardContent>

        <CardFooter className="justify-end">
          <Button type="submit" disabled={pending}>
            {pending ? "作成中…" : "作成"}
          </Button>
        </CardFooter>
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
