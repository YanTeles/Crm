"use client";

import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { useUrlState } from "@/components/data/url-state";
import { useWorkspace } from "@/components/layout/workspace-context";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ClientLookups } from "@/features/workspace/lookups";

const ALL = "__all__";

export function LeadFilters({ lookups }: { lookups: ClientLookups }) {
  const ws = useWorkspace();
  const { params, set, pending } = useUrlState();
  const [q, setQ] = useState(params.get("q") ?? "");

  // Busca com debounce
  useEffect(() => {
    const current = params.get("q") ?? "";
    if (q === current) return;
    const t = setTimeout(() => set({ q }), 350);
    return () => clearTimeout(t);
  }, [q, params, set]);

  const field = lookups.customFields.find((f) => f.id === params.get("campo"));
  const hasFilters =
    ["q", "etapa", "responsavel", "origem", "campo", "valor"].some((k) => params.get(k)) ||
    (params.get("status") ?? "open") !== "open";

  const select = (
    key: string,
    placeholder: string,
    options: { value: string; label: string }[],
    fallback = ALL,
  ) => (
    <Select value={params.get(key) ?? fallback} onValueChange={(v) => set({ [key]: v === ALL ? null : v })}>
      <SelectTrigger className="w-full sm:w-44" aria-label={placeholder}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center" aria-busy={pending}>
      <InputGroup className="sm:w-72">
        <InputGroupAddon>
          <Search />
        </InputGroupAddon>
        <InputGroupInput
          placeholder="Buscar nome, telefone, e-mail…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Buscar leads"
        />
      </InputGroup>
      {select(
        "status",
        "Situação",
        [
          { value: "open", label: "Em aberto" },
          { value: "won", label: "Ganhos" },
          { value: "lost", label: "Perdidos" },
          { value: "all", label: "Todos (ativos)" },
          { value: "archived", label: "Arquivados" },
        ],
        "open",
      )}
      {select("etapa", "Etapa", [
        { value: ALL, label: "Todas as etapas" },
        ...lookups.stages.filter((s) => !s.archived_at).map((s) => ({ value: s.id, label: s.name })),
      ])}
      {ws.isAdmin
        ? select("responsavel", "Responsável", [
            { value: ALL, label: "Todos os responsáveis" },
            { value: "none", label: "Sem responsável" },
            ...lookups.members
              .filter((m) => m.role === "seller" || m.status === "inactive")
              .map((m) => ({
                value: m.userId,
                label: m.status === "inactive" ? `${m.name} (inativo)` : m.name,
              })),
          ])
        : null}
      {select("origem", "Origem", [
        { value: ALL, label: "Todas as origens" },
        ...lookups.sources.map((s) => ({ value: s.id, label: s.name })),
      ])}
      {lookups.customFields.length
        ? select("campo", "Campo personalizado", [
            { value: ALL, label: "Campo personalizado" },
            ...lookups.customFields.map((f) => ({ value: f.id, label: f.label })),
          ])
        : null}
      {field ? (
        field.field_type === "select" ? (
          select("valor", "Valor", [
            { value: ALL, label: "Qualquer valor" },
            ...field.options.map((o) => ({ value: o.id, label: o.label })),
          ])
        ) : (
          <Input
            key={field.id}
            className="sm:w-44"
            type={field.field_type === "number" ? "number" : field.field_type === "date" ? "date" : "text"}
            defaultValue={params.get("valor") ?? ""}
            placeholder="Valor"
            aria-label={`Valor de ${field.label}`}
            onBlur={(e) => set({ valor: e.target.value })}
            onKeyDown={(e) => e.key === "Enter" && set({ valor: (e.target as HTMLInputElement).value })}
          />
        )
      ) : null}
      {hasFilters ? (
        <Button
          variant="ghost"
          onClick={() => {
            setQ("");
            set({
              q: null,
              status: null,
              etapa: null,
              responsavel: null,
              origem: null,
              campo: null,
              valor: null,
            });
          }}
        >
          <X /> Limpar
        </Button>
      ) : null}
    </div>
  );
}
