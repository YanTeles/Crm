"use client";

import { useState, useTransition } from "react";
import { Check, Copy, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { SubmitButton } from "@/components/forms/submit-button";
import { useWorkspace } from "@/components/layout/workspace-context";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDateTime } from "@/lib/format";
import { createInvitation } from "../actions";

export function InviteDialog() {
  const ws = useWorkspace();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"seller" | "admin">("seller");
  const [result, setResult] = useState<{ link: string; expiresAt: string } | null>(null);
  const [copied, setCopied] = useState(false);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) {
          setEmail("");
          setRole("seller");
          setResult(null);
          setCopied(false);
        }
        setOpen(o);
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <UserPlus /> Convidar
        </Button>
      </DialogTrigger>
      <DialogContent>
        {result ? (
          <>
            <DialogHeader>
              <DialogTitle>Convite criado</DialogTitle>
              <DialogDescription>
                Envie este link para {email}. Ele é de uso único e expira em{" "}
                {formatDateTime(result.expiresAt, ws.timezone)}.
              </DialogDescription>
            </DialogHeader>
            <InputGroup>
              <InputGroupInput
                readOnly
                value={result.link}
                aria-label="Link do convite"
                onFocus={(e) => e.target.select()}
              />
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  aria-label="Copiar link"
                  onClick={async () => {
                    await navigator.clipboard.writeText(result.link);
                    setCopied(true);
                    toast.success("Link copiado.");
                  }}
                >
                  {copied ? <Check /> : <Copy />}
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
            <Alert>
              <AlertDescription>
                Por segurança o link não é exibido novamente. Se perdê-lo, gere um novo convite (o anterior é
                revogado).
              </AlertDescription>
            </Alert>
            <DialogFooter>
              <Button onClick={() => setOpen(false)}>Concluir</Button>
            </DialogFooter>
          </>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              startTransition(async () => {
                const r = await createInvitation({ companyId: ws.companyId, email, role, slug: ws.slug });
                if (r.ok) setResult(r.data);
                else toast.error(r.error);
              });
            }}
          >
            <DialogHeader>
              <DialogTitle>Convidar para a equipe</DialogTitle>
              <DialogDescription>
                A pessoa precisará entrar ou criar a conta com este e-mail para aceitar.
              </DialogDescription>
            </DialogHeader>
            <FieldGroup className="py-4">
              <Field>
                <FieldLabel htmlFor="invite-email">E-mail</FieldLabel>
                <Input
                  id="invite-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoFocus
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="invite-role">Papel</FieldLabel>
                <Select value={role} onValueChange={(v) => setRole(v as "seller" | "admin")}>
                  <SelectTrigger id="invite-role" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="seller">Vendedor</SelectItem>
                    <SelectItem value="admin">Administrador</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </FieldGroup>
            <DialogFooter>
              <SubmitButton pending={pending}>Gerar convite</SubmitButton>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
