"use client";

import { useActionState } from "react";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { joinRoom, type JoinRoomState } from "../actions";
import { NICKNAME_MAX_LENGTH } from "../constants";

const initialState: JoinRoomState = {};

export function JoinForm({ inviteToken }: { inviteToken: string }) {
  const [state, formAction, pending] = useActionState(joinRoom, initialState);

  return (
    <form action={formAction} noValidate className="flex flex-col gap-6">
      <input type="hidden" name="inviteToken" value={inviteToken} />
      <div className="flex flex-col gap-2">
        <label htmlFor="nickname" className="text-sm font-medium">
          ニックネーム
        </label>
        <Input
          id="nickname"
          name="nickname"
          placeholder="例: ゆい"
          maxLength={NICKNAME_MAX_LENGTH}
          autoComplete="nickname"
          defaultValue={state.fields?.nickname}
          aria-invalid={!!state.errors?.nickname}
          aria-describedby={state.errors?.nickname ? "nickname-error" : undefined}
          required
          className="h-12 rounded-xl px-4"
        />
        {state.errors?.nickname && (
          <p id="nickname-error" className="text-sm text-destructive">
            {state.errors.nickname}
          </p>
        )}
      </div>

      {state.message && (
        <p role="status" className="text-sm text-ink-muted">
          {state.message}
        </p>
      )}

      <Button type="submit" disabled={pending} className="h-12 w-full gap-2 rounded-xl text-sm font-bold">
        <ArrowRight aria-hidden />
        {pending ? "入室中…" : "トークルームに入室"}
      </Button>
    </form>
  );
}
