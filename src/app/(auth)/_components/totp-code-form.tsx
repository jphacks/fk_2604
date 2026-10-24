"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { TOTP_CODE_LENGTH } from "../validation";

export type TotpCodeState = {
  error?: string;
  message?: string;
};

const initialState: TotpCodeState = {};

// ログイン時の二要素認証と、新規登録時の認証アプリ登録で共通の6桁コード入力フォーム
export function TotpCodeForm({
  action,
  submitLabel,
}: {
  action: (prevState: TotpCodeState, formData: FormData) => Promise<TotpCodeState>;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} noValidate>
      <CardContent className="flex flex-col gap-4 pb-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="code" className="text-sm font-medium">
            確認コード（{TOTP_CODE_LENGTH}桁）
          </label>
          <Input
            id="code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            maxLength={TOTP_CODE_LENGTH}
            className="h-10 text-center font-mono text-lg tracking-[0.5em] md:text-lg"
            aria-invalid={!!state.error}
            aria-describedby={state.error ? "code-error" : undefined}
            required
          />
          {state.error && (
            <p id="code-error" className="text-sm text-destructive">
              {state.error}
            </p>
          )}
        </div>

        {state.message && (
          <p role="status" className="text-sm text-muted-foreground">
            {state.message}
          </p>
        )}
      </CardContent>

      <CardFooter className="justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "確認中…" : submitLabel}
        </Button>
      </CardFooter>
    </form>
  );
}
