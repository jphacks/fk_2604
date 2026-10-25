"use server";

import { revalidatePath } from "next/cache";

import { requireAdminAal2 } from "@/lib/admin-authorization";
import {
  endOfDayJst,
  formatMonthDay,
  toJstDate,
  validateRoomPeriodUpdate,
} from "@/lib/room-period";

export type UpdatePeriodState = {
  error?: string;
  message?: string;
};

export async function updateRoomPeriod(
  _prevState: UpdatePeriodState,
  formData: FormData,
): Promise<UpdatePeriodState> {
  const roomId = String(formData.get("roomId") ?? "");
  const startDate = String(formData.get("startDate") ?? "");
  const endDate = String(formData.get("endDate") ?? "");

  const { supabase, user } = await requireAdminAal2();

  const { data: room } = await supabase
    .from("rooms")
    .select("owner_id, starts_at")
    .eq("id", roomId)
    .maybeSingle();
  if (!room || room.owner_id !== user.id) {
    return { error: "このルームの設定を変更する権限がありません" };
  }

  const currentStartDate = toJstDate(room.starts_at);
  const error = validateRoomPeriodUpdate(currentStartDate, startDate, endDate);
  if (error) return { error };

  const { data: updated, error: updateError } = await supabase
    .from("rooms")
    .update({
      // 開始日を変えていなければ、元の開始時刻をそのまま残す
      starts_at: startDate === currentStartDate ? room.starts_at : `${startDate}T00:00:00+09:00`,
      expires_at: new Date(endOfDayJst(endDate)).toISOString(),
    })
    .eq("id", roomId)
    .select("id");
  if (updateError || !updated?.length) {
    return { error: "利用期間を変更できませんでした" };
  }

  revalidatePath(`/rooms/${roomId}/settings`);
  return { message: `利用期間を${formatMonthDay(startDate)}〜${formatMonthDay(endDate)}に変更しました` };
}
