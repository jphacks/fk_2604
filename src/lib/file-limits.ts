/**
 * ファイル共有の上限。画面（送る前のチェック）とAPI（受け取ったときのチェック）の両方で使う。
 * 数字を変えたいときはここだけ書き換える。
 */

/** 1ファイルの上限：10MB */
export const MAX_FILE_BYTES = 10 * 1024 * 1024;

/** 1ルームで共有できる合計：50MB（メモリ／ストレージを使いすぎないため） */
export const MAX_ROOM_BYTES = 50 * 1024 * 1024;

/**
 * ブラウザ上でそのまま表示（プレビュー）してよい画像の種類。
 * SVG はスクリプトを埋め込めて危険なので入れない。
 * これ以外のファイルは、開くと必ずダウンロードになる。
 */
export const PREVIEWABLE_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
] as const;

export function isPreviewableImage(mimeType: string) {
  return (PREVIEWABLE_IMAGE_TYPES as readonly string[]).includes(mimeType);
}
