"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { useWorkspace } from "@/components/layout/workspace-context";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { ClientLookups } from "@/features/workspace/lookups";
import type { CustomValueMap } from "./custom-field-inputs";
import { LeadForm } from "./lead-form";

type EditableLead = React.ComponentProps<typeof LeadForm>["lead"];

export function LeadSheet({
  lookups,
  lead,
  initialCustom,
}: {
  lookups: ClientLookups;
  lead?: EditableLead;
  initialCustom?: CustomValueMap;
}) {
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const router = useRouter();
  const ws = useWorkspace();

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setFormKey((k) => k + 1);
      }}
    >
      <SheetTrigger asChild>
        {lead ? (
          <Button variant="outline">
            <Pencil /> Editar
          </Button>
        ) : (
          <Button>
            <Plus /> Novo lead
          </Button>
        )}
      </SheetTrigger>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{lead ? "Editar lead" : "Novo lead"}</SheetTitle>
          <SheetDescription>
            {lead
              ? "Atualize os dados do lead."
              : "Telefone duplicado gera um aviso, mas não impede o cadastro."}
          </SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-6">
          <LeadForm
            key={formKey}
            lookups={lookups}
            lead={lead}
            initialCustom={initialCustom}
            onDone={(id) => {
              setOpen(false);
              if (!lead) router.push(`/app/${ws.slug}/leads/${id}`);
            }}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
