import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Mail, MessageSquareText, Phone, PhoneCall } from "lucide-react";
import { OutcomeBadge, SaleStatusBadge } from "@/components/data/status-badges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { initialCustomValues } from "@/features/leads/components/custom-field-inputs";
import { InteractionForm } from "@/features/leads/components/interaction-form";
import { LeadActions } from "@/features/leads/components/lead-actions";
import { LeadSheet } from "@/features/leads/components/lead-sheet";
import { CHANNEL_LABEL, describeEvent } from "@/features/leads/labels";
import { getLead, getLeadDetail } from "@/features/leads/queries";
import { SaleDialog } from "@/features/sales/components/sale-dialog";
import { SaleRowActions } from "@/features/sales/components/sale-row-actions";
import { TaskDialog } from "@/features/tasks/components/task-dialog";
import { TaskList } from "@/features/tasks/components/task-list";
import { clientLookups, getLookups } from "@/features/workspace/lookups";
import { requireWorkspace } from "@/lib/auth/session";
import { formatCurrency, formatDate, formatDateTime, formatPlainDate } from "@/lib/format";
import { formatPhone } from "@/lib/phone";

export const metadata: Metadata = { title: "Lead" };

export default async function LeadDetailPage({ params }: PageProps<"/app/[slug]/leads/[id]">) {
  const { slug, id } = await params;
  const ws = await requireWorkspace(slug);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const lead = await getLead(id);
  if (!lead || lead.company_id !== ws.company.id) notFound();

  const [lookups, detail] = await Promise.all([getLookups(ws.company.id), getLeadDetail(id)]);
  const cl = clientLookups(lookups);
  const tz = ws.company.timezone;
  const names = {
    stage: (sid: string | null) => lookups.stages.find((s) => s.id === sid)?.name ?? "—",
    member: (uid: string | null) => lookups.memberName(uid) ?? "—",
    reason: (rid: string | null) => lookups.reasons.find((r) => r.id === rid)?.name ?? "—",
  };

  const timeline = [
    ...detail.events.map((e) => ({
      key: `e${e.id}`,
      at: e.occurred_at,
      kind: "event" as const,
      text: describeEvent(e, names),
      author: names.member(e.actor_id),
    })),
    ...detail.interactions.map((i) => ({
      key: `i${i.id}`,
      at: i.occurred_at,
      kind: i.kind,
      text: i.content,
      author: names.member(i.author_id),
      channel: i.channel ? CHANNEL_LABEL[i.channel] : null,
    })),
  ].sort((a, b) => (a.at < b.at ? 1 : -1));

  const customValues = initialCustomValues(detail.customValues);
  const completedRevenue = detail.sales
    .filter((s) => s.status === "completed")
    .reduce((sum, s) => sum + Number(s.amount), 0);
  const now = new Date().toISOString();
  const leadRef = { id: lead.id, name: lead.name };

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
          <Link href={`/app/${slug}/leads`}>
            <ArrowLeft /> Leads
          </Link>
        </Button>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{lead.name}</h1>
              <OutcomeBadge outcome={lead.outcome} archived={Boolean(lead.archived_at)} />
              <Badge variant="outline">{names.stage(lead.stage_id)}</Badge>
            </div>
            <p className="text-muted-foreground mt-1 text-sm">
              {lead.assigned_to ? `Responsável: ${names.member(lead.assigned_to)}` : "Sem responsável"} ·
              Criado em {formatDate(lead.created_at, tz)} por {names.member(lead.created_by)}
            </p>
          </div>
          {!lead.archived_at ? (
            <LeadSheet
              lookups={cl}
              initialCustom={customValues}
              lead={{
                id: lead.id,
                name: lead.name,
                phone_raw: lead.phone_raw,
                email: lead.email,
                customer_company: lead.customer_company,
                source_id: lead.source_id,
                notes: lead.notes,
                row_version: lead.row_version,
              }}
            />
          ) : null}
        </div>
        <div className="mt-4">
          <LeadActions lead={lead} lookups={cl} />
        </div>
      </div>

      {lead.outcome !== "open" ? (
        <div className="bg-muted/40 rounded-xl border p-4 text-sm">
          {lead.outcome === "won" ? (
            <>
              Ganho em {formatDateTime(lead.won_at, tz)} · valor do ganho{" "}
              <strong>{formatCurrency(lead.won_amount)}</strong>
            </>
          ) : (
            <>
              Perdido em {formatDateTime(lead.closed_at, tz)} · motivo{" "}
              <strong>{names.reason(lead.lost_reason_id)}</strong>
              {lead.lost_note ? ` — ${lead.lost_note}` : ""}
            </>
          )}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Tabs defaultValue="historico">
          <TabsList>
            <TabsTrigger value="historico">Histórico</TabsTrigger>
            <TabsTrigger value="tarefas">
              Tarefas ({detail.tasks.filter((t) => t.status === "pending").length})
            </TabsTrigger>
            <TabsTrigger value="vendas">Vendas ({detail.sales.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="historico" className="space-y-4">
            {!lead.archived_at ? <InteractionForm leadId={lead.id} /> : null}
            <ol className="relative space-y-4 border-l pl-6">
              {timeline.map((t) => (
                <li key={t.key} className="relative">
                  <span className="bg-background absolute top-0.5 -left-[33px] flex size-5 items-center justify-center rounded-full border">
                    {t.kind === "event" ? (
                      <span className="bg-primary size-1.5 rounded-full" />
                    ) : t.kind === "contact" ? (
                      <PhoneCall className="text-primary size-3" aria-hidden />
                    ) : (
                      <MessageSquareText className="text-primary size-3" aria-hidden />
                    )}
                  </span>
                  <div className={t.kind === "event" ? "text-sm" : "bg-card rounded-lg border p-3 text-sm"}>
                    {t.kind !== "event" ? (
                      <p className="mb-1 text-xs font-medium">
                        {t.kind === "contact"
                          ? `Contato${"channel" in t && t.channel ? ` · ${t.channel}` : ""}`
                          : "Observação"}
                      </p>
                    ) : null}
                    <p className="whitespace-pre-line">{t.text}</p>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {formatDateTime(t.at, tz)} · {t.author}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </TabsContent>

          <TabsContent value="tarefas" className="space-y-3">
            {!lead.archived_at ? (
              <div className="flex justify-end">
                <TaskDialog members={cl.members} fixedLead={leadRef} />
              </div>
            ) : null}
            <TaskList
              tasks={detail.tasks.map((t) => ({ ...t, lead: leadRef }))}
              members={cl.members}
              showLead={false}
              emptyText="Nenhuma tarefa para este lead."
              now={now}
            />
          </TabsContent>

          <TabsContent value="vendas" className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-muted-foreground text-sm">
                Faturamento concluído deste lead:{" "}
                <strong className="text-foreground">{formatCurrency(completedRevenue)}</strong>
              </p>
              {!lead.archived_at ? (
                <SaleDialog members={cl.members} fixedLead={leadRef} defaultSeller={lead.assigned_to} />
              ) : null}
            </div>
            {detail.sales.length ? (
              <ul className="bg-card divide-y rounded-xl border">
                {detail.sales.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center gap-3 p-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{s.description}</p>
                      <p className="text-muted-foreground text-xs">
                        {names.member(s.seller_id)} ·{" "}
                        {s.status === "completed"
                          ? `concluída em ${formatDate(s.completed_at, tz)}`
                          : `registrada em ${formatDate(s.created_at, tz)}`}
                        {s.cancel_reason ? ` · cancelada: ${s.cancel_reason}` : ""}
                      </p>
                    </div>
                    <SaleStatusBadge status={s.status} />
                    <span className="w-28 text-right font-medium tabular-nums">
                      {formatCurrency(s.amount)}
                    </span>
                    <SaleRowActions
                      members={cl.members}
                      sale={{
                        id: s.id,
                        description: s.description,
                        amount: Number(s.amount),
                        status: s.status,
                        completed_at: s.completed_at,
                        seller_id: s.seller_id,
                        row_version: s.row_version,
                      }}
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground rounded-xl border p-6 text-center text-sm">
                Nenhuma venda registrada.
              </p>
            )}
          </TabsContent>
        </Tabs>

        <aside className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Contato</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="flex items-center gap-2">
                <Phone className="text-muted-foreground size-4" aria-hidden />{" "}
                {formatPhone(lead.phone_normalized)}
              </p>
              {lead.email ? (
                <p className="flex items-center gap-2 break-all">
                  <Mail className="text-muted-foreground size-4" aria-hidden />
                  <a href={`mailto:${lead.email}`} className="hover:underline">
                    {lead.email}
                  </a>
                </p>
              ) : null}
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 pt-2">
                <dt className="text-muted-foreground">Empresa</dt>
                <dd>{lead.customer_company ?? "—"}</dd>
                <dt className="text-muted-foreground">Origem</dt>
                <dd>{lookups.sources.find((s) => s.id === lead.source_id)?.name ?? "—"}</dd>
                <dt className="text-muted-foreground">Atualizado</dt>
                <dd>{formatDateTime(lead.updated_at, tz)}</dd>
              </dl>
              {lead.notes ? (
                <p className="text-muted-foreground border-t pt-2 whitespace-pre-line">{lead.notes}</p>
              ) : null}
            </CardContent>
          </Card>
          {lookups.customFields.length ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Campos personalizados</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                  {lookups.customFields
                    .filter((f) => f.is_active || customValues[f.id] != null)
                    .map((f) => {
                      const v = customValues[f.id];
                      const display =
                        v == null
                          ? "—"
                          : f.field_type === "select"
                            ? (f.options.find((o) => o.id === v)?.label ?? "—")
                            : f.field_type === "date"
                              ? formatPlainDate(String(v))
                              : String(v);
                      return (
                        <div key={f.id} className="contents">
                          <dt className="text-muted-foreground">{f.label}</dt>
                          <dd>{display}</dd>
                        </div>
                      );
                    })}
                </dl>
              </CardContent>
            </Card>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
