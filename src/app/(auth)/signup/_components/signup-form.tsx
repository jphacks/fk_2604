"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PASSWORD_MIN_LENGTH } from "../../validation";
import { signup, type SignupState } from "../actions";

const initialState: SignupState = {};

export function SignupForm() {
  const [state, formAction, pending] = useActionState(signup, initialState);

  return (
    <form action={formAction} noValidate>
      <CardContent className="flex flex-col gap-4 pb-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="email" className="text-sm font-medium">
            メールアドレス
          </label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="admin@example.com"
            defaultValue={state.fields?.email}
            aria-invalid={!!state.errors?.email}
            aria-describedby={state.errors?.email ? "email-error" : undefined}
            required
          />
          {state.errors?.email && (
            <p id="email-error" className="text-sm text-destructive">
              {state.errors.email}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className="text-sm font-medium">
            パスワード
          </label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={PASSWORD_MIN_LENGTH}
            aria-invalid={!!state.errors?.password}
            aria-describedby="password-hint"
            required
          />
          <p
            id="password-hint"
            className={state.errors?.password ? "text-sm text-destructive" : "text-xs text-muted-foreground"}
          >
            {state.errors?.password ??
              `${PASSWORD_MIN_LENGTH}文字以上で、英字と数字を両方含めてください`}
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="passwordConfirm" className="text-sm font-medium">
            パスワード（確認）
          </label>
          <Input
            id="passwordConfirm"
            name="passwordConfirm"
            type="password"
            autoComplete="new-password"
            aria-invalid={!!state.errors?.passwordConfirm}
            aria-describedby={state.errors?.passwordConfirm ? "passwordConfirm-error" : undefined}
            required
          />
          {state.errors?.passwordConfirm && (
            <p id="passwordConfirm-error" className="text-sm text-destructive">
              {state.errors.passwordConfirm}
            </p>
          )}
        </div>
      </CardContent>

      <CardFooter className="justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "登録中…" : "次へ"}
        </Button>
      </CardFooter>
      {state.message && (
        <p role="status" className="px-6 pb-4 text-sm text-muted-foreground">
          {state.message}
        </p>
      )}
    </form>
  );
}
