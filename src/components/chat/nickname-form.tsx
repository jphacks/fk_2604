"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Logo } from "@/components/brand/logo";

/**
 * 仮の入室フォーム（ニックネームだけ入力）。
 * 本番では S-08 ゲスト入室画面（/join/[inviteToken]）がこの役割を担う。
 */
export function NicknameForm({ onSubmit }: { onSubmit: (nickname: string) => void }) {
  const [name, setName] = useState("");

  return (
    <main className="flex min-h-dvh items-center justify-center bg-paper p-4 text-ink">
      <form
        className="w-full max-w-sm space-y-5 rounded-2xl border border-line bg-card p-6 md:p-8"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) onSubmit(name.trim());
        }}
      >
        <Logo />
        <div className="space-y-2">
          <label htmlFor="nickname" className="text-sm font-medium">
            ニックネーム
          </label>
          <Input
            id="nickname"
            value={name}
            maxLength={20}
            placeholder="例：もえ"
            onChange={(e) => setName(e.target.value)}
            className="h-12 rounded-xl bg-paper px-4"
          />
        </div>
        <Button type="submit" disabled={!name.trim()} className="h-12 w-full rounded-xl hover:bg-cloud-strong">
          入室する
        </Button>
      </form>
    </main>
  );
}
