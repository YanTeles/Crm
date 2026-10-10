"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

// Atualiza parâmetros da URL (filtros persistem ao recarregar/compartilhar o link).
export function useUrlState() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const set = useCallback(
    (
      updates: Record<string, string | null | undefined>,
      opts: { resetPage?: boolean } = { resetPage: true },
    ) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(updates)) {
        if (v === null || v === undefined || v === "") next.delete(k);
        else next.set(k, v);
      }
      if (opts.resetPage) next.delete("pagina");
      const qs = next.toString();
      startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
    },
    [params, pathname, router],
  );

  return { params, set, pending };
}

export function Pagination({ page, pageSize, total }: { page: number; pageSize: number; total: number }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const href = (p: number) => {
    const next = new URLSearchParams(params.toString());
    if (p <= 1) next.delete("pagina");
    else next.set("pagina", String(p));
    const qs = next.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };
  const from = total ? (page - 1) * pageSize + 1 : 0;
  const to = Math.min(total, page * pageSize);

  return (
    <nav
      className="text-muted-foreground mt-3 flex items-center justify-between text-sm"
      aria-label="Paginação"
    >
      <span>
        {from}–{to} de {total}
      </span>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="sm" asChild={page > 1} disabled={page <= 1}>
          {page > 1 ? (
            <Link href={href(page - 1)} aria-label="Página anterior">
              <ChevronLeft /> Anterior
            </Link>
          ) : (
            <span>
              <ChevronLeft /> Anterior
            </span>
          )}
        </Button>
        <span className="px-2">
          {page} / {pages}
        </span>
        <Button variant="outline" size="sm" asChild={page < pages} disabled={page >= pages}>
          {page < pages ? (
            <Link href={href(page + 1)} aria-label="Próxima página">
              Próxima <ChevronRight />
            </Link>
          ) : (
            <span>
              Próxima <ChevronRight />
            </span>
          )}
        </Button>
      </div>
    </nav>
  );
}
