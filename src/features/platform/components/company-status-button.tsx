"use client";

import { useState } from "react";
import { useAction } from "@/components/forms/use-action-form";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { setCompanyStatus } from "../actions";

export function CompanyStatusButton({
  companyId,
  name,
  status,
}: {
  companyId: string;
  name: string;
  status: "active" | "suspended";
}) {
  const { pending, run } = useAction();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const suspending = status === "active";

  return (
    <AlertDialog
      open={open}
      onOpenChange={(o) => {
        if (o) setReason("");
        setOpen(o);
      }}
    >
      <AlertDialogTrigger asChild>
        <Button variant={suspending ? "outline" : "default"} size="sm">
          {suspending ? "Suspender" : "Reativar"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{suspending ? `Suspender ${name}?` : `Reativar ${name}?`}</AlertDialogTitle>
          <AlertDialogDescription>
            {suspending
              ? "Todos os usuários perdem o acesso operacional imediatamente. Os dados são preservados."
              : "Os usuários ativos voltam a acessar o CRM."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {suspending ? (
          <Field>
            <FieldLabel htmlFor={`reason-${companyId}`}>Motivo (registrado na auditoria)</FieldLabel>
            <Textarea
              id={`reason-${companyId}`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
            />
          </Field>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <Button
            variant={suspending ? "destructive" : "default"}
            disabled={pending || (suspending && !reason.trim())}
            onClick={() =>
              run(
                () => setCompanyStatus({ companyId, status: suspending ? "suspended" : "active", reason }),
                {
                  onSuccess: () => setOpen(false),
                },
              )
            }
          >
            Confirmar
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
