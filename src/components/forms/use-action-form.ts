"use client";

import { useTransition } from "react";
import type { FieldValues, Path, UseFormReturn } from "react-hook-form";
import { toast } from "sonner";
import type { ActionResult } from "@/lib/action";

// Executa uma Server Action a partir de um formulário RHF: aplica erros de
// campo vindos do servidor, mostra toasts e expõe o estado pendente.
export function useActionSubmit<T extends FieldValues, R>(
  form: UseFormReturn<T>,
  action: (values: T) => Promise<ActionResult<R>>,
  opts: { onSuccess?: (data: R) => void; successMessage?: string } = {},
) {
  const [pending, startTransition] = useTransition();

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const result = await action(values);
      if (!result) return; // redirect
      if (result.ok) {
        const msg = result.message ?? opts.successMessage;
        if (msg) toast.success(msg);
        opts.onSuccess?.(result.data);
        return;
      }
      for (const [key, messages] of Object.entries(result.fieldErrors ?? {})) {
        if (key !== "_") form.setError(key as Path<T>, { message: messages[0] });
      }
      toast.error(result.error);
    });
  });

  return { pending, onSubmit };
}

// Para ações sem formulário (botões, menus).
export function useAction() {
  const [pending, startTransition] = useTransition();
  function run<R>(
    action: () => Promise<ActionResult<R>>,
    opts: { onSuccess?: (data: R) => void; successMessage?: string } = {},
  ) {
    startTransition(async () => {
      const result = await action();
      if (!result) return;
      if (result.ok) {
        const msg = result.message ?? opts.successMessage;
        if (msg) toast.success(msg);
        opts.onSuccess?.(result.data);
      } else {
        toast.error(result.error);
      }
    });
  }
  return { pending, run };
}
