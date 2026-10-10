"use client";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useAction } from "@/components/forms/use-action-form";
import { acceptInvitation } from "../actions";

export function AcceptInvitationButton({ token }: { token: string }) {
  const { pending, run } = useAction();
  return (
    <Button
      className="w-full"
      size="lg"
      disabled={pending}
      onClick={() => run(() => acceptInvitation(token))}
    >
      {pending ? <Spinner /> : null}
      Aceitar convite
    </Button>
  );
}
