"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Check, Pencil, Plus, Star, Trash2, X } from "lucide-react";
import { useAction } from "@/components/forms/use-action-form";
import { useWorkspace } from "@/components/layout/workspace-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { StageOption } from "@/features/workspace/lookups";
import { archiveStage, createStage, renameStage, reorderStages, setDefaultStage } from "../actions";

export function StagesManager({
  stages,
  leadCounts,
}: {
  stages: StageOption[];
  leadCounts: Record<string, number>;
}) {
  const ws = useWorkspace();
  const { pending, run } = useAction();
  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [removing, setRemoving] = useState<StageOption | null>(null);
  const [target, setTarget] = useState("");

  const active = stages.filter((s) => !s.archived_at);
  const open = active.filter((s) => s.kind === "open");
  const closed = active.filter((s) => s.kind !== "open");

  function move(index: number, delta: number) {
    const ids = open.map((s) => s.id);
    const [item] = ids.splice(index, 1);
    ids.splice(index + delta, 0, item);
    run(() => reorderStages({ companyId: ws.companyId, stageIds: ids, slug: ws.slug }));
  }

  const row = (s: StageOption, index?: number) => (
    <li key={s.id} className="flex items-center gap-2 py-2">
      {editing?.id === s.id ? (
        <form
          className="flex flex-1 items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => renameStage({ stageId: s.id, name: editing.name, slug: ws.slug }), {
              onSuccess: () => setEditing(null),
            });
          }}
        >
          <Input
            value={editing.name}
            onChange={(e) => setEditing({ id: s.id, name: e.target.value })}
            maxLength={60}
            autoFocus
            aria-label="Nome da etapa"
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
          <span className="flex-1">
            {s.name}
            {s.is_default ? (
              <Badge variant="secondary" className="ml-2">
                Inicial
              </Badge>
            ) : null}
            {s.kind === "won" ? <Badge className="ml-2 bg-emerald-600 text-white">Ganho</Badge> : null}
            {s.kind === "lost" ? (
              <Badge variant="destructive" className="ml-2">
                Perdido
              </Badge>
            ) : null}
            <span className="text-muted-foreground ml-2 text-xs">{leadCounts[s.id] ?? 0} lead(s)</span>
          </span>
          {index !== undefined ? (
            <>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Mover para cima"
                disabled={pending || index === 0}
                onClick={() => move(index, -1)}
              >
                <ArrowUp />
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Mover para baixo"
                disabled={pending || index === open.length - 1}
                onClick={() => move(index, 1)}
              >
                <ArrowDown />
              </Button>
              {!s.is_default ? (
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Definir como etapa inicial"
                  title="Definir como etapa inicial"
                  disabled={pending}
                  onClick={() => run(() => setDefaultStage({ stageId: s.id, slug: ws.slug }))}
                >
                  <Star />
                </Button>
              ) : null}
            </>
          ) : null}
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Renomear"
            onClick={() => setEditing({ id: s.id, name: s.name })}
          >
            <Pencil />
          </Button>
          {s.kind === "open" && !s.is_default ? (
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Remover etapa"
              onClick={() => {
                setTarget(open.find((o) => o.id !== s.id && o.is_default)?.id ?? "");
                setRemoving(s);
              }}
            >
              <Trash2 />
            </Button>
          ) : null}
        </>
      )}
    </li>
  );

  return (
    <div className="max-w-2xl space-y-6">
      <section>
        <h3 className="mb-1 font-medium">Etapas em andamento</h3>
        <p className="text-muted-foreground mb-2 text-sm">
          Ordem exibida no funil. A etapa inicial recebe os novos leads.
        </p>
        <ul className="divide-y rounded-lg border px-3">{open.map((s, i) => row(s, i))}</ul>
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => createStage({ companyId: ws.companyId, name: newName, slug: ws.slug }), {
              onSuccess: () => setNewName(""),
            });
          }}
        >
          <Input
            placeholder="Nova etapa"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            maxLength={60}
            aria-label="Nome da nova etapa"
          />
          <Button type="submit" disabled={pending || !newName.trim()}>
            <Plus /> Adicionar
          </Button>
        </form>
      </section>
      <section>
        <h3 className="mb-1 font-medium">Etapas de fechamento</h3>
        <p className="text-muted-foreground mb-2 text-sm">
          Ganho e Perdido são fixos (podem ser renomeados) para manter os indicadores coerentes.
        </p>
        <ul className="divide-y rounded-lg border px-3">{closed.map((s) => row(s))}</ul>
      </section>

      <Dialog open={removing !== null} onOpenChange={(o) => !o && setRemoving(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remover etapa “{removing?.name}”</DialogTitle>
            <DialogDescription>
              {removing && leadCounts[removing.id]
                ? `${leadCounts[removing.id]} lead(s) estão nesta etapa e serão movidos para a etapa escolhida. A movimentação fica no histórico.`
                : "Nenhum lead está nesta etapa."}
            </DialogDescription>
          </DialogHeader>
          {removing && leadCounts[removing.id] ? (
            <Field>
              <FieldLabel htmlFor="stage-target">Mover leads para</FieldLabel>
              <Select value={target} onValueChange={setTarget}>
                <SelectTrigger id="stage-target" className="w-full">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {open
                    .filter((o) => o.id !== removing.id)
                    .map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </Field>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoving(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={pending || Boolean(removing && leadCounts[removing.id] && !target)}
              onClick={() =>
                removing &&
                run(
                  () => archiveStage({ stageId: removing.id, targetStageId: target || null, slug: ws.slug }),
                  {
                    onSuccess: () => setRemoving(null),
                  },
                )
              }
            >
              Remover etapa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
