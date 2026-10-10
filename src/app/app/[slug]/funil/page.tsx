import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { LeadSheet } from "@/features/leads/components/lead-sheet";
import { AssigneeFilter } from "@/features/pipeline/components/assignee-filter";
import { KanbanBoard } from "@/features/pipeline/components/kanban-board";
import { getBoard } from "@/features/pipeline/queries";
import { clientLookups, getLookups } from "@/features/workspace/lookups";
import { requireWorkspace } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Funil" };

// Remonta o quadro quando os dados do servidor mudam (após router.refresh).
function boardKey(board: Awaited<ReturnType<typeof getBoard>>) {
  let h = 5381;
  for (const col of Object.values(board))
    for (const c of col.cards)
      for (const ch of c.id + c.row_version) h = ((h << 5) + h + ch.charCodeAt(0)) | 0;
  return String(h);
}

export default async function PipelinePage({ params, searchParams }: PageProps<"/app/[slug]/funil">) {
  const { slug } = await params;
  const ws = await requireWorkspace(slug);
  const sp = await searchParams;
  const raw = typeof sp.responsavel === "string" ? sp.responsavel : undefined;
  const assignee = ws.isAdmin && raw && (raw === "none" || /^[0-9a-f-]{36}$/i.test(raw)) ? raw : undefined;

  const lookups = await getLookups(ws.company.id);
  const board = await getBoard(ws.company.id, lookups.stages, { assignee });
  const cl = clientLookups(lookups);

  return (
    <>
      <PageHeader
        title="Funil de vendas"
        description={
          ws.isAdmin
            ? "Arraste os cartões entre as etapas. Ganho e Perdido pedem confirmação."
            : "Seus leads por etapa. Arraste para movimentar."
        }
        actions={
          <>
            {ws.isAdmin ? <AssigneeFilter members={cl.members} /> : null}
            <LeadSheet lookups={cl} />
          </>
        }
      />
      <KanbanBoard
        key={boardKey(board) + (assignee ?? "")}
        initial={board}
        lookups={cl}
        assigneeFilter={assignee}
      />
    </>
  );
}
