// 表示用フォーマット（時刻・消滅日）

export function formatTime(ms: number) {
  return new Date(ms).toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// 消滅日：long なら「10月27日(火)」、short なら「10/27(火)」
export function formatExpiryDate(
  expiresAt: number | undefined,
  style: "long" | "short",
) {
  if (!expiresAt) return "--";
  return new Date(expiresAt).toLocaleDateString("ja-JP", {
    month: style === "long" ? "long" : "numeric",
    day: "numeric",
    weekday: "short",
  });
}
