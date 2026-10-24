"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { joinRoom, type JoinRoomState } from "../actions";
import { NICKNAME_MAX_LENGTH } from "../constants";

const initialState: JoinRoomState = {};

export function JoinForm({ inviteToken }: { inviteToken: string }) {
  const [state, formAction, pending] = useActionState(joinRoom, initialState);

  return (
    <form action={formAction} noValidate>
      <input type="hidden" name="inviteToken" value={inviteToken} />
      <CardContent className="flex flex-col gap-4 pb-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="nickname" className="text-sm font-medium">
            ニックネーム
          </label>
          <Input
            id="nickname"
            name="nickname"
            placeholder="例: たろう"
            maxLength={NICKNAME_MAX_LENGTH}
            autoComplete="nickname"
            defaultValue={state.fields?.nickname}
            aria-invalid={!!state.errors?.nickname}
            aria-describedby={state.errors?.nickname ? "nickname-error" : undefined}
            required
          />
          {state.errors?.nickname && (
            <p id="nickname-error" className="text-sm text-destructive">
              {state.errors.nickname}
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
          {pending ? "入室中…" : "入室"}
        </Button>
      </CardFooter>
    </form>
  );
}
