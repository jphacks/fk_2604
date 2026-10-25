"use client";

import { useRef, useState } from "react";
import { NotebookPen, Paperclip, Plus, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ShareButton } from "./share-button";

type ChatComposerProps = {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  sending: boolean;
  onOpenNote: () => void;
  onShareFile: () => void;
  /** 「準備中です」などの一言 */
  notice?: string | null;
};

/**
 * メッセージ入力欄と共有メニュー。
 *  - スマホ：「＋」を押すと「消えるノート / ファイル共有」の大きいボタンが開く
 *  - PC（md以上）：共有ボタンを入力欄の上に常に表示
 */
export function ChatComposer({
  value,
  onChange,
  onSend,
  sending,
  onOpenNote,
  onShareFile,
  notice,
}: ChatComposerProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const composing = useRef(false); // 日本語変換中のEnterを送信と誤認しないため

  const openNote = () => {
    setMenuOpen(false);
    onOpenNote();
  };
  const shareFile = () => {
    setMenuOpen(false);
    onShareFile();
  };

  return (
    <div className="shrink-0 border-t border-line bg-card px-4 pt-3.5 pb-[max(env(safe-area-inset-bottom),0.75rem)] md:border-t-0 md:bg-transparent md:px-8 md:pb-6">
      <div className="mx-auto max-w-4xl">
        {notice && (
          <p role="status" className="mb-2 text-center text-xs text-ink-muted">
            {notice}
          </p>
        )}

        {menuOpen && (
          <div className="mb-3 grid grid-cols-2 gap-2.5 md:hidden">
            <ShareButton icon={NotebookPen} label="消えるノート" onClick={openNote} size="large" />
            <ShareButton icon={Paperclip} label="ファイル共有" onClick={shareFile} size="large" />
          </div>
        )}

        <div className="mb-2.5 hidden items-center gap-2.5 md:flex">
          <span className="text-[11px] text-ink-muted">＋ で共有</span>
          <ShareButton icon={NotebookPen} label="消えるノート" onClick={openNote} />
          <ShareButton icon={Paperclip} label="ファイル共有" onClick={shareFile} />
        </div>

        <div className="flex items-end gap-2.5 md:gap-3">
          <button
            type="button"
            aria-label="共有メニュー"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
            className="flex h-12 w-8 shrink-0 items-center justify-center text-ink md:hidden"
          >
            {menuOpen ? <X className="size-5" /> : <Plus className="size-[22px]" />}
          </button>
          <textarea
            value={value}
            rows={1}
            maxLength={1000}
            placeholder="メッセージを入力…"
            aria-label="メッセージ"
            className="max-h-32 min-h-12 flex-1 resize-none rounded-xl border border-line bg-paper px-3.5 py-3 text-[13px] text-ink outline-none placeholder:text-ink-muted/80 focus:border-cloud focus:ring-3 focus:ring-cloud/40 md:min-h-[54px] md:bg-card md:px-5 md:py-4 md:text-sm"
            onChange={(e) => onChange(e.target.value)}
            onCompositionStart={() => (composing.current = true)}
            onCompositionEnd={() => (composing.current = false)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !composing.current) {
                e.preventDefault();
                onSend();
              }
            }}
          />
          <Button
            type="button"
            onClick={onSend}
            disabled={sending || !value.trim()}
            aria-label="送信"
            className="size-12 gap-2.5 rounded-xl hover:bg-cloud-strong md:h-[54px] md:w-auto md:px-6"
          >
            <Send className="size-[18px]" />
            <span className="hidden md:inline">送信</span>
          </Button>
        </div>

        <p className="mt-3 text-center text-[10px] text-ink-muted lg:hidden">
          期限がくると、会話・ノート・ファイルは消えます。
        </p>
      </div>
    </div>
  );
}
