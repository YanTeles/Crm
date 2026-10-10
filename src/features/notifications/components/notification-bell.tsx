"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlarmClock, Bell, CheckCheck, ListChecks, UserPlus, X } from "lucide-react";
import { useWorkspace } from "@/components/layout/workspace-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/types/database";

type Notification = Tables<"notifications">;

function describe(n: Notification, base: string) {
  const data = (n.data ?? {}) as Record<string, string | number | null>;
  switch (n.type) {
    case "lead_assigned":
      return n.entity_type === "member"
        ? { icon: UserPlus, text: `${data.count} lead(s) transferido(s) para você`, href: `${base}/leads` }
        : {
            icon: UserPlus,
            text: `Novo lead atribuído: ${data.lead_name ?? ""}`,
            href: `${base}/leads/${n.entity_id}`,
          };
    case "task_assigned":
      return { icon: ListChecks, text: `Nova tarefa: ${data.title ?? ""}`, href: `${base}/tarefas` };
    case "task_overdue":
      return {
        icon: AlarmClock,
        text: `Tarefa atrasada: ${data.title ?? ""}`,
        href: `${base}/tarefas?visao=atrasadas`,
      };
  }
}

export function NotificationBell() {
  const ws = useWorkspace();
  const supabase = createClient();
  const qc = useQueryClient();
  const key = ["notifications", ws.companyId, ws.userId];

  const { data = [] } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("company_id", ws.companyId)
        .eq("user_id", ws.userId)
        .is("dismissed_at", null)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data;
    },
    refetchInterval: 120_000,
  });

  // Realtime: apenas as notificações do próprio usuário (a RLS também filtra).
  useEffect(() => {
    const channel = supabase
      .channel(`notifications:${ws.userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${ws.userId}` },
        () => qc.invalidateQueries({ queryKey: key }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ws.userId, ws.companyId]);

  const update = useMutation({
    mutationFn: async ({ ids, field }: { ids: string[]; field: "read_at" | "dismissed_at" }) => {
      if (!ids.length) return;
      const now = new Date().toISOString();
      const { error } = await supabase
        .from("notifications")
        .update(field === "read_at" ? { read_at: now } : { dismissed_at: now, read_at: now })
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const unread = data.filter((n) => !n.read_at);
  const base = `/app/${ws.slug}`;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={`Notificações (${unread.length} não lidas)`}
        >
          <Bell />
          {unread.length ? (
            <Badge className="absolute -top-1 -right-1 h-4 min-w-4 rounded-full px-1 text-[10px]">
              {unread.length > 9 ? "9+" : unread.length}
            </Badge>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-medium">Notificações</span>
          <Button
            variant="ghost"
            size="sm"
            disabled={!unread.length || update.isPending}
            onClick={() => update.mutate({ ids: unread.map((n) => n.id), field: "read_at" })}
          >
            <CheckCheck /> Marcar como lidas
          </Button>
        </div>
        {data.length === 0 ? (
          <p className="text-muted-foreground p-6 text-center text-sm">Nenhuma notificação.</p>
        ) : (
          <ScrollArea className="max-h-96">
            <ul className="divide-y">
              {data.map((n) => {
                const d = describe(n, base);
                return (
                  <li key={n.id} className={n.read_at ? "opacity-70" : ""}>
                    <div className="hover:bg-muted/60 flex items-start gap-2 px-3 py-2.5">
                      <d.icon className="text-primary mt-0.5 size-4 shrink-0" aria-hidden />
                      <Link
                        href={d.href}
                        className="flex-1 text-sm"
                        onClick={() => !n.read_at && update.mutate({ ids: [n.id], field: "read_at" })}
                      >
                        <span className={n.read_at ? "" : "font-medium"}>{d.text}</span>
                        <span className="text-muted-foreground block text-xs">
                          {formatDateTime(n.created_at, ws.timezone)}
                        </span>
                      </Link>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-label="Dispensar"
                        onClick={() => update.mutate({ ids: [n.id], field: "dismissed_at" })}
                      >
                        <X />
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </ScrollArea>
        )}
      </PopoverContent>
    </Popover>
  );
}
