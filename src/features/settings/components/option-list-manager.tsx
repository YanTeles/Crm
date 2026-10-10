"use client";

import { useState } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { useAction } from "@/components/forms/use-action-form";
import { useWorkspace } from "@/components/layout/workspace-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { NamedOption } from "@/features/workspace/lookups";
import { createOption, deleteOption, updateOption } from "../actions";

// Origens e motivos de perda: itens usados não são excluídos — são desativados.
export function OptionListManager({
  table,
  items,
  description,
}: {
  table: "lead_sources" | "lost_reasons";
  items: NamedOption[];
  description: string;
}) {
  const ws = useWorkspace();
  const { pending, run } = useAction();
  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);

  return (
    <div className="max-w-2xl">
      <p className="text-muted-foreground mb-3 text-sm">{description}</p>
      <ul className="divide-y rounded-lg border px-3">
        {items.map((item) => (
          <li key={item.id} className="flex items-center gap-2 py-2">
            {editing?.id === item.id ? (
              <form
                className="flex flex-1 items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  run(() => updateOption({ table, id: item.id, name: editing.name, slug: ws.slug }), {
                    onSuccess: () => setEditing(null),
                  });
                }}
              >
                <Input
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  maxLength={80}
                  autoFocus
                  aria-label="Nome"
                />
                <Button size="icon-sm" type="submit" aria-label="Salvar" disabled={pending}>
                  <Check />
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  type="button"
                  aria-label="Cancelar"
                  onClick={() => setEditing(null)}
                >
                  <X />
                </Button>
              </form>
            ) : (
              <>
                <span className={item.is_active ? "flex-1" : "text-muted-foreground flex-1"}>
                  {item.name}
                  {!item.is_active ? (
                    <Badge variant="outline" className="ml-2">
                      Desativado
                    </Badge>
                  ) : null}
                </span>
                <Switch
                  checked={item.is_active}
                  disabled={pending}
                  aria-label={item.is_active ? `Desativar ${item.name}` : `Ativar ${item.name}`}
                  onCheckedChange={(v) =>
                    run(() => updateOption({ table, id: item.id, isActive: v, slug: ws.slug }))
                  }
                />
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Renomear ${item.name}`}
                  onClick={() => setEditing({ id: item.id, name: item.name })}
                >
                  <Pencil />
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Excluir ${item.name}`}
                  title="Só é possível excluir itens nunca usados"
                  disabled={pending}
                  onClick={() => run(() => deleteOption({ table, id: item.id, slug: ws.slug }))}
                >
                  <Trash2 />
                </Button>
              </>
            )}
          </li>
        ))}
        {!items.length ? (
          <li className="text-muted-foreground py-4 text-center text-sm">Nenhum item.</li>
        ) : null}
      </ul>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => createOption({ table, companyId: ws.companyId, name: newName, slug: ws.slug }), {
            onSuccess: () => setNewName(""),
          });
        }}
      >
        <Input
          placeholder="Novo item"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          maxLength={80}
          aria-label="Nome do novo item"
        />
        <Button type="submit" disabled={pending || !newName.trim()}>
          <Plus /> Adicionar
        </Button>
      </form>
    </div>
  );
}
