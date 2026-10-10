"use client";

import { useState } from "react";
import { useAction } from "@/components/forms/use-action-form";
import { useWorkspace } from "@/components/layout/workspace-context";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { addInteraction } from "../actions";

const CHANNELS = [
  { value: "phone", label: "Telefone" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "email", label: "E-mail" },
  { value: "meeting", label: "Reunião" },
  { value: "other", label: "Outro" },
] as const;

export function InteractionForm({ leadId }: { leadId: string }) {
  const ws = useWorkspace();
  const { pending, run } = useAction();
  const [kind, setKind] = useState<"note" | "contact">("contact");
  const [channel, setChannel] = useState<(typeof CHANNELS)[number]["value"]>("whatsapp");
  const [content, setContent] = useState("");

  return (
    <form
      className="bg-card space-y-3 rounded-xl border p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!content.trim()) return;
        run(
          () =>
            addInteraction({
              leadId,
              companyId: ws.companyId,
              slug: ws.slug,
              kind,
              channel: kind === "contact" ? channel : undefined,
              content,
            }),
          { onSuccess: () => setContent("") },
        );
      }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <ToggleGroup
          type="single"
          variant="outline"
          value={kind}
          onValueChange={(v) => v && setKind(v as "note" | "contact")}
          aria-label="Tipo de registro"
        >
          <ToggleGroupItem value="contact">Contato realizado</ToggleGroupItem>
          <ToggleGroupItem value="note">Observação</ToggleGroupItem>
        </ToggleGroup>
        {kind === "contact" ? (
          <Select value={channel} onValueChange={(v) => setChannel(v as typeof channel)}>
            <SelectTrigger className="w-36" aria-label="Canal">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CHANNELS.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
      </div>
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={kind === "contact" ? "Resumo do contato…" : "Escreva uma observação…"}
        rows={3}
        maxLength={5000}
        aria-label="Conteúdo"
      />
      <div className="flex justify-end">
        <Button type="submit" disabled={pending || !content.trim()}>
          {pending ? <Spinner /> : null} Registrar
        </Button>
      </div>
    </form>
  );
}
