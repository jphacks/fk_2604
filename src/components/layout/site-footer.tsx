import { siteConfig } from "@/config/site";

/** ページ下のフッター（キャッチコピー）。ダッシュボード・入室画面など、スクロールする画面で使う */
export function SiteFooter() {
  return (
    <footer className="border-t border-line px-5 py-6 text-xs text-ink-muted md:px-12">
      {siteConfig.tagline}
    </footer>
  );
}
