import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { InviteDialog } from "@/features/team/components/invite-dialog";
import { MemberActions } from "@/features/team/components/member-actions";
import { RevokeInvitationButton } from "@/features/team/components/revoke-button";
import { clientLookups, getLookups } from "@/features/workspace/lookups";
import { requireWorkspace } from "@/lib/auth/session";
import { formatDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Equipe" };

function isExpired(iso: string) {
  return new Date(iso).getTime() < new Date().getTime();
}

export default async function TeamPage({ params }: PageProps<"/app/[slug]/equipe">) {
  const { slug } = await params;
  const ws = await requireWorkspace(slug, { admin: true });
  const supabase = await createClient();

  const [lookups, counts, invitations] = await Promise.all([
    getLookups(ws.company.id),
    supabase.rpc("count_leads_by_member", { p_company_id: ws.company.id }),
    supabase
      .from("company_invitations")
      .select("id, email, role, expires_at, created_at")
      .eq("company_id", ws.company.id)
      .is("accepted_at", null)
      .is("revoked_at", null)
      .order("created_at", { ascending: false }),
  ]);
  const cl = clientLookups(lookups);
  const leadCount = (userId: string) => counts.data?.find((c) => c.user_id === userId);

  return (
    <>
      <PageHeader
        title="Equipe"
        description="Gerencie vendedores e administradores. Somente vendedores ativos recebem leads."
        actions={<InviteDialog />}
      />

      <Card>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Nome</TableHead>
                <TableHead>Papel</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Leads em aberto</TableHead>
                <TableHead className="w-12 pr-6">
                  <span className="sr-only">Ações</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cl.members.map((m) => {
                const c = leadCount(m.userId);
                return (
                  <TableRow key={m.memberId}>
                    <TableCell className="pl-6">
                      <span className="font-medium">{m.name}</span>
                      {m.userId === ws.user.id ? (
                        <span className="text-muted-foreground"> (você)</span>
                      ) : null}
                      <span className="text-muted-foreground block text-xs">{m.email}</span>
                    </TableCell>
                    <TableCell>{m.role === "admin" ? "Administrador" : "Vendedor"}</TableCell>
                    <TableCell>
                      {m.status === "active" ? (
                        <Badge variant="secondary">Ativo</Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          Inativo
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="hidden text-right tabular-nums sm:table-cell">
                      {c ? (
                        <>
                          {Number(c.open_total)}
                          {Number(c.total) !== Number(c.open_total) ? (
                            <span className="text-muted-foreground"> / {Number(c.total)} total</span>
                          ) : null}
                        </>
                      ) : (
                        0
                      )}
                    </TableCell>
                    <TableCell className="pr-6 text-right">
                      <MemberActions member={m} members={cl.members} leadCount={c ? Number(c.total) : 0} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Convites pendentes</CardTitle>
          <CardDescription>
            Convites expiram em 7 dias e só podem ser usados pelo e-mail convidado.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {invitations.data?.length ? (
            <ul className="divide-y">
              {invitations.data.map((i) => {
                const expired = isExpired(i.expires_at);
                return (
                  <li key={i.id} className="flex flex-wrap items-center gap-2 py-2.5">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{i.email}</span>
                      <span className="text-muted-foreground text-xs">
                        {i.role === "admin" ? "Administrador" : "Vendedor"} ·{" "}
                        {expired
                          ? "expirado"
                          : `expira em ${formatDateTime(i.expires_at, ws.company.timezone)}`}
                      </span>
                    </span>
                    <RevokeInvitationButton invitationId={i.id} />
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-muted-foreground text-sm">Nenhum convite pendente.</p>
          )}
        </CardContent>
      </Card>
    </>
  );
}
