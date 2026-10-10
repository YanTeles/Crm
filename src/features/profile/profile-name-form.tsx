"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { SubmitButton } from "@/components/forms/submit-button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { updateProfileName } from "./actions";

export function ProfileNameForm({ defaultName }: { defaultName: string }) {
  const [name, setName] = useState(defaultName);
  const [pending, startTransition] = useTransition();
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const r = await updateProfileName({ fullName: name });
          if (r.ok) toast.success(r.message);
          else toast.error(r.error);
        });
      }}
    >
      <Field>
        <FieldLabel htmlFor="profile-name">Nome</FieldLabel>
        <Input
          id="profile-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={120}
          autoComplete="name"
        />
      </Field>
      <div>
        <SubmitButton pending={pending}>Salvar</SubmitButton>
      </div>
    </form>
  );
}
