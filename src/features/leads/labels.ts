import { formatCurrency } from "@/lib/format";
import type { Tables } from "@/types/database";

export const CHANNEL_LABEL: Record<string, string> = {
  phone: "Telefone",
  whatsapp: "WhatsApp",
  email: "E-mail",
  meeting: "Reunião",
  other: "Outro",
};

const FIELD_LABEL: Record<string, string> = {
  name: "nome",
  phone_raw: "telefone",
  phone_normalized: "telefone normalizado",
  email: "e-mail",
  customer_company: "empresa do cliente",
  source_id: "origem",
  notes: "observações",
};

const METHOD_LABEL: Record<string, string> = {
  rotation: "rodízio automático",
  manual: "atribuição manual",
  self: "cadastro pelo vendedor",
  bulk_transfer: "transferência em lote",
  stage_archived: "remoção de etapa",
  none: "sem atribuição",
};

type Names = {
  stage: (id: string | null) => string;
  member: (id: string | null) => string;
  reason: (id: string | null) => string;
};

// Texto legível para cada evento do histórico.
export function describeEvent(e: Tables<"lead_events">, n: Names): string {
  const data = (e.data ?? {}) as Record<string, unknown>;
  switch (e.event_type) {
    case "created":
      return `Lead criado (${METHOD_LABEL[String(data.method)] ?? "cadastro"})`;
    case "updated": {
      const fields = Object.keys((data.changes as object) ?? {})
        .filter((k) => k !== "phone_normalized")
        .map((k) => FIELD_LABEL[k] ?? k);
      return `Dados alterados: ${fields.join(", ") || "—"}`;
    }
    case "custom_fields_updated":
      return `Campos personalizados alterados: ${Object.keys((data.changes as object) ?? {}).join(", ")}`;
    case "assigned": {
      const via = METHOD_LABEL[String(data.method)] ?? "";
      if (!e.to_assignee) return `Responsável removido (antes: ${n.member(e.from_assignee)})`;
      const tasks = Number(data.tasks_transferred ?? 0);
      return `${e.from_assignee ? `Transferido de ${n.member(e.from_assignee)} para` : "Atribuído a"} ${n.member(e.to_assignee)}${via ? ` · ${via}` : ""}${tasks ? ` · ${tasks} tarefa(s) transferida(s)` : ""}`;
    }
    case "stage_changed":
      return `Etapa: ${n.stage(e.from_stage_id)} → ${n.stage(e.to_stage_id)}`;
    case "won":
      return `Marcado como ganho · ${formatCurrency(e.amount)}`;
    case "lost":
      return `Marcado como perdido · ${n.reason(e.lost_reason_id)}${data.note ? ` — "${String(data.note)}"` : ""}`;
    case "reopened":
      return `Oportunidade reaberta em ${n.stage(e.to_stage_id)} (antes: ${data.previous_outcome === "won" ? `ganho de ${formatCurrency(e.amount)}` : `perdido · ${n.reason(e.lost_reason_id)}`})`;
    case "archived":
      return "Lead arquivado";
    case "unarchived":
      return "Lead restaurado";
    case "sale_created":
      return `Venda registrada · ${formatCurrency(e.amount)}${data.status === "completed" ? " (concluída)" : " (pendente)"}`;
    case "sale_updated":
      return `Venda alterada · ${formatCurrency(e.amount)}`;
    case "sale_completed":
      return `Venda concluída · ${formatCurrency(e.amount)}`;
    case "sale_cancelled":
      return `Venda cancelada · ${formatCurrency(e.amount)}${data.reason ? ` — "${String(data.reason)}"` : ""}`;
  }
}
