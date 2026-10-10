"use client";

import { X } from "lucide-react";
import { useAction } from "@/components/forms/use-action-form";
import { useWorkspace } from "@/components/layout/workspace-context";
import { Button } from "@/components/ui/button";
import { revokeInvitation } from "../actions";

export function RevokeInvitationButton({ invitationId }: { invitationId: string }) {
  const ws = useWorkspace();
  const { pending, run } = useAction();
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={() => run(() => revokeInvitation({ invitationId, slug: ws.slug }))}
    >
      <X /> Revogar
    </Button>
  );
}
