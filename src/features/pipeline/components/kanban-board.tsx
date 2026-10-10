"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useWorkspace } from "@/components/layout/workspace-context";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LostDialog, WonDialog } from "@/features/leads/components/close-dialogs";
import { moveLeadStage } from "@/features/leads/actions";
import type { ClientLookups } from "@/features/workspace/lookups";
import { formatCurrency } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { initials } from "@/lib/text";
import { cn } from "@/lib/utils";
import type { KanbanCard } from "../queries";

type Board = Record<string, { cards: KanbanCard[]; total: number }>;
const PAGE = 30;
// Colunas de fechamento exibem os últimos 30 dias.
function closedSince() {
  return new Date(new Date().getTime() - 30 * 86400_000).toISOString();
}

const CARD_COLUMNS =
  "id, name, customer_company, assigned_to, stage_id, outcome, won_amount, row_version, updated_at";

export function KanbanBoard({
  initial,
  lookups,
  assigneeFilter,
}: {
  initial: Board;
  lookups: ClientLookups;
  assigneeFilter?: string;
}) {
  const ws = useWorkspace();
  const router = useRouter();
  const [board, setBoard] = useState<Board>(initial);
  const [active, setActive] = useState<KanbanCard | null>(null);
  const [closing, setClosing] = useState<{ kind: "won" | "lost"; card: KanbanCard } | null>(null);
  const [loadingStage, setLoadingStage] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const stages = lookups.stages.filter((s) => !s.archived_at);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor),
  );
  const memberName = (id: string | null) => lookups.members.find((m) => m.userId === id)?.name ?? null;
  const canMove = (c: KanbanCard) => c.outcome === "open" && (ws.isAdmin || c.assigned_to === ws.userId);

  function moveLocal(card: KanbanCard, toStage: string) {
    setBoard((b) => {
      const from = b[card.stage_id];
      const to = b[toStage];
      if (!from || !to) return b;
      return {
        ...b,
        [card.stage_id]: { cards: from.cards.filter((c) => c.id !== card.id), total: from.total - 1 },
        [toStage]: {
          cards: [{ ...card, stage_id: toStage, row_version: card.row_version + 1 }, ...to.cards],
          total: to.total + 1,
        },
      };
    });
  }

  function onDragStart(e: DragStartEvent) {
    setActive((e.active.data.current?.card as KanbanCard) ?? null);
  }

  function onDragEnd(e: DragEndEvent) {
    setActive(null);
    const card = e.active.data.current?.card as KanbanCard | undefined;
    const toStage = e.over?.id as string | undefined;
    if (!card || !toStage || toStage === card.stage_id) return;
    const stage = stages.find((s) => s.id === toStage);
    if (!stage) return;
    if (stage.kind === "won" || stage.kind === "lost") {
      setClosing({ kind: stage.kind, card });
      return;
    }
    const snapshot = board;
    moveLocal(card, toStage);
    startTransition(async () => {
      const r = await moveLeadStage({
        leadId: card.id,
        stageId: toStage,
        version: card.row_version,
        slug: ws.slug,
      });
      if (!r.ok) {
        setBoard(snapshot);
        toast.error(r.error);
      }
    });
  }

  async function loadMore(stageId: string) {
    const col = board[stageId];
    const stage = stages.find((s) => s.id === stageId);
    if (!col || !stage) return;
    setLoadingStage(stageId);
    const supabase = createClient();
    let q = supabase
      .from("leads")
      .select(CARD_COLUMNS)
      .eq("company_id", ws.companyId)
      .eq("stage_id", stageId)
      .is("archived_at", null);
    if (stage.kind !== "open") q = q.gte("closed_at", closedSince());
    if (assigneeFilter === "none") q = q.is("assigned_to", null);
    else if (assigneeFilter) q = q.eq("assigned_to", assigneeFilter);
    const { data, error } = await q
      .order("updated_at", { ascending: false })
      .range(col.cards.length, col.cards.length + PAGE - 1);
    setLoadingStage(null);
    if (error) return toast.error("Não foi possível carregar mais leads.");
    setBoard((b) => ({
      ...b,
      [stageId]: { ...b[stageId], cards: [...b[stageId].cards, ...((data ?? []) as KanbanCard[])] },
    }));
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={() => setActive(null)}
      >
        <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6">
          {stages.map((s) => {
            const col = board[s.id] ?? { cards: [], total: 0 };
            return (
              <Column key={s.id} id={s.id} title={s.name} kind={s.kind} total={col.total}>
                {col.cards.map((c) => (
                  <DraggableCard
                    key={c.id}
                    card={c}
                    disabled={!canMove(c)}
                    assignee={ws.isAdmin ? memberName(c.assigned_to) : null}
                    slug={ws.slug}
                  />
                ))}
                {col.cards.length < col.total ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full"
                    disabled={loadingStage === s.id}
                    onClick={() => loadMore(s.id)}
                  >
                    {loadingStage === s.id ? <Loader2 className="animate-spin" /> : null}
                    Carregar mais ({col.total - col.cards.length})
                  </Button>
                ) : null}
                {!col.cards.length ? (
                  <p className="text-muted-foreground py-6 text-center text-xs">
                    {s.kind === "open" ? "Arraste leads para cá" : "Sem fechamentos nos últimos 30 dias"}
                  </p>
                ) : null}
              </Column>
            );
          })}
        </div>
        <DragOverlay>
          {active ? (
            <CardView card={active} assignee={ws.isAdmin ? memberName(active.assigned_to) : null} dragging />
          ) : null}
        </DragOverlay>
      </DndContext>

      <WonDialog
        lead={closing?.kind === "won" ? closing.card : null}
        open={closing?.kind === "won"}
        onOpenChange={(o) => !o && setClosing(null)}
        onDone={() => router.refresh()}
      />
      <LostDialog
        lead={closing?.kind === "lost" ? closing.card : null}
        reasons={lookups.reasons}
        open={closing?.kind === "lost"}
        onOpenChange={(o) => !o && setClosing(null)}
        onDone={() => router.refresh()}
      />
    </>
  );
}

function Column({
  id,
  title,
  kind,
  total,
  children,
}: {
  id: string;
  title: string;
  kind: "open" | "won" | "lost";
  total: number;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <section
      ref={setNodeRef}
      aria-label={`Etapa ${title}`}
      className={cn(
        "bg-muted/50 flex max-h-[calc(100svh-12rem)] w-72 shrink-0 snap-start flex-col rounded-xl border",
        isOver && "ring-primary/50 ring-2",
        kind === "won" && "border-emerald-500/30",
        kind === "lost" && "border-rose-500/30",
      )}
    >
      <header className="flex items-center justify-between px-3 py-2.5">
        <h2 className="text-sm font-medium">{title}</h2>
        <Badge variant="secondary">{total}</Badge>
      </header>
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2">{children}</div>
    </section>
  );
}

function DraggableCard({
  card,
  disabled,
  assignee,
  slug,
}: {
  card: KanbanCard;
  disabled: boolean;
  assignee: string | null;
  slug: string;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: card.id,
    data: { card },
    disabled,
  });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={cn(isDragging && "opacity-40")}
    >
      <CardView
        card={card}
        assignee={assignee}
        href={`/app/${slug}/leads/${card.id}`}
        handle={disabled ? null : { ...attributes, ...listeners }}
      />
    </div>
  );
}

function CardView({
  card,
  assignee,
  href,
  handle,
  dragging,
}: {
  card: KanbanCard;
  assignee: string | null;
  href?: string;
  handle?: Record<string, unknown> | null;
  dragging?: boolean;
}) {
  return (
    <article
      className={cn("bg-card flex gap-1 rounded-lg border p-2.5 shadow-xs", dragging && "rotate-2 shadow-lg")}
    >
      {handle ? (
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground -ml-1 cursor-grab touch-none rounded p-0.5 active:cursor-grabbing"
          aria-label={`Mover ${card.name}`}
          {...handle}
        >
          <GripVertical className="size-4" />
        </button>
      ) : null}
      <div className="min-w-0 flex-1">
        {href ? (
          <Link href={href} className="block truncate text-sm font-medium hover:underline">
            {card.name}
          </Link>
        ) : (
          <span className="block truncate text-sm font-medium">{card.name}</span>
        )}
        {card.customer_company ? (
          <p className="text-muted-foreground truncate text-xs">{card.customer_company}</p>
        ) : null}
        <div className="mt-2 flex items-center justify-between gap-2">
          {card.outcome === "won" && card.won_amount !== null ? (
            <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
              {formatCurrency(card.won_amount)}
            </span>
          ) : (
            <span />
          )}
          {assignee ? (
            <Avatar className="size-6" title={assignee}>
              <AvatarFallback className="text-[10px]">{initials(assignee)}</AvatarFallback>
            </Avatar>
          ) : null}
        </div>
      </div>
    </article>
  );
}
