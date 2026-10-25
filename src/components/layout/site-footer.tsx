import { siteConfig } from "@/config/site";

/**
 * ページ下のフッター（キャッチコピー）。ダッシュボード・入室画面など、スクロールする画面で使う。
 * text を渡すと、その画面だけ別の文言にできる（例：入室画面）
 */
export function SiteFooter({ text = siteConfig.tagline }: { text?: string }) {
  return (
    <footer className="border-t border-line px-5 py-6 text-xs text-ink-muted md:px-12">
      {text}
    </footer>
  );
}
