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

// ファイルサイズ：「820 B」「12.3 KB」「4.5 MB」
export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  // 「10.0 MB」は「10 MB」にする
  const fixed = (n: number) => n.toFixed(1).replace(/\.0$/, "");
  if (bytes < 1024 * 1024) return `${fixed(bytes / 1024)} KB`;
  return `${fixed(bytes / 1024 / 1024)} MB`;
}
