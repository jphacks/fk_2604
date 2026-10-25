"use client";

import { useActionState, useState } from "react";
import type { DateRange } from "react-day-picker";
import { ja } from "react-day-picker/locale";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  countDays,
  formatMonthDay,
  MAX_ROOM_DAYS,
  toDateString,
} from "@/lib/room-period";
import { updateRoomPeriod, type UpdatePeriodState } from "../actions";

const initialState: UpdatePeriodState = {};

function fromDateString(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function addDays(date: Date, days: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

export function PeriodForm({
  roomId,
  initialStartDate,
  initialEndDate,
  started,
}: {
  roomId: string;
  initialStartDate: string;
  initialEndDate: string;
  started: boolean; // 開始済みなら開始日は固定し、終了日だけ選べる
}) {
  const [state, formAction, pending] = useActionState(updateRoomPeriod, initialState);
  const [range, setRange] = useState<DateRange | undefined>({
    from: fromDateString(initialStartDate),
    to: fromDateString(initialEndDate),
  });

  const startDate = range?.from ? toDateString(range.from) : "";
  const endDate = range?.to ? toDateString(range.to) : startDate;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // 開始日を選んでいる途中（または開始日が固定）なら、最大日数を超える日を選べなくする
  const latestEnd =
    range?.from && (started || !range.to) ? addDays(range.from, MAX_ROOM_DAYS - 1) : undefined;

  return (
    <form action={formAction} className="flex flex-col gap-2" noValidate>
      <fieldset className="flex flex-col gap-1.5" aria-describedby="period-summary">
        <legend className="mb-1.5 text-sm font-medium">利用期間</legend>
        <p className="text-xs text-muted-foreground">
          {started
            ? `開始済みのため、変更できるのは終了日だけです。終了日をクリックして選んでください（開始日から最大${MAX_ROOM_DAYS}日）`
            : `開始日と終了日をクリックして選んでください（最大${MAX_ROOM_DAYS}日）`}
          。終了日の23:59にルームは消えます
        </p>
        {started ? (
          <Calendar
            mode="range"
            locale={ja}
            selected={range}
            // 開始日は固定し、クリックした日を終了日にする
            onSelect={(_selected, day) => setRange({ from: range?.from, to: day })}
            defaultMonth={fromDateString(initialEndDate)}
            disabled={[{ before: today }, ...(latestEnd ? [{ after: latestEnd }] : [])]}
            className="mx-auto rounded-lg border"
          />
        ) : (
          <Calendar
            mode="range"
            locale={ja}
            selected={range}
            onSelect={setRange}
            resetOnSelect
            defaultMonth={fromDateString(initialStartDate)}
            disabled={[{ before: today }, ...(latestEnd ? [{ after: latestEnd }] : [])]}
            className="mx-auto rounded-lg border"
          />
        )}
        <input type="hidden" name="roomId" value={roomId} />
        <input type="hidden" name="startDate" value={startDate} />
        <input type="hidden" name="endDate" value={endDate} />
        <p id="period-summary" aria-live="polite" className="text-sm">
          {startDate
            ? `${formatMonthDay(startDate)}〜${formatMonthDay(endDate)}（${countDays(startDate, endDate)}日間）`
            : "未選択"}
        </p>
      </fieldset>

      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      {state.message && !state.error && (
        <p role="status" className="text-sm text-muted-foreground">
          {state.message}
        </p>
      )}

      <Button type="submit" className="self-end" disabled={pending}>
        {pending ? "保存中…" : "利用期間を保存"}
      </Button>
    </form>
  );
}
