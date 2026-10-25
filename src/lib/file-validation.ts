import { isPreviewableImage } from "./file-limits";

export function cleanFileName(name: string) {
  const cleaned = name.toWellFormed().replace(/[\\/\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, "_").trim();
  return Array.from(cleaned).slice(0, 120).join("") || "file";
}

// Only raster image signatures are trusted for inline rendering. Unrecognized or
// mismatched image declarations are served as downloads, never as active HTML/SVG.
export function validatedMime(declared: string, bytes: Uint8Array) {
  const mime = declared.toLowerCase().trim() || "application/octet-stream";
  if (!/^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/.test(mime) || mime.length > 255) return null;
  if (!isPreviewableImage(mime)) return mime;
  const matches = (signature: number[], offset = 0) => signature.every((value, i) => bytes[offset + i] === value);
  const valid = mime === "image/png" ? matches([137,80,78,71,13,10,26,10])
    : mime === "image/jpeg" ? matches([255,216,255])
    : mime === "image/gif" ? matches([71,73,70,56,55,97]) || matches([71,73,70,56,57,97])
    : matches([82,73,70,70]) && matches([87,69,66,80], 8);
  return valid ? mime : "application/octet-stream";
}

export function downloadHeaders(file: { name: string; size: number; mimeType: string }, force: boolean) {
  const inline = !force && isPreviewableImage(file.mimeType);
  const name = encodeURIComponent(cleanFileName(file.name)).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return {
    "Content-Type": inline ? file.mimeType : "application/octet-stream",
    "Content-Length": String(file.size),
    "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="file"; filename*=UTF-8''${name}`,
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; sandbox",
    "Cache-Control": "private, no-store",
  };
}
