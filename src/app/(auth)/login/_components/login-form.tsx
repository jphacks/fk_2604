"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { login, type LoginState } from "../actions";

const initialState: LoginState = {};

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, initialState);

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
            autoComplete="current-password"
            aria-invalid={!!state.errors?.password}
            aria-describedby={state.errors?.password ? "password-error" : undefined}
            required
          />
          {state.errors?.password && (
            <p id="password-error" className="text-sm text-destructive">
              {state.errors.password}
            </p>
          )}
        </div>
      </CardContent>

      <CardFooter className="justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "確認中…" : "次へ"}
        </Button>
      </CardFooter>
    </form>
  );
}
