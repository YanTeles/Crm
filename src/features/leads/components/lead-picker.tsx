"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown } from "lucide-react";
import { useWorkspace } from "@/components/layout/workspace-context";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { createClient } from "@/lib/supabase/client";
import { escapeLike, normalizeSearch } from "@/lib/text";
import { cn } from "@/lib/utils";

export type PickedLead = { id: string; name: string };

// Busca de leads acessíveis ao usuário (a RLS limita o vendedor aos próprios).
export function LeadPicker({
  id,
  value,
  onChange,
  allowEmpty = true,
}: {
  id?: string;
  value: PickedLead | null;
  onChange: (lead: PickedLead | null) => void;
  allowEmpty?: boolean;
}) {
  const ws = useWorkspace();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const { data = [], isFetching } = useQuery({
    queryKey: ["lead-picker", ws.companyId, search],
    enabled: open,
    queryFn: async () => {
      const supabase = createClient();
      let q = supabase
        .from("leads")
        .select("id, name, customer_company")
        .eq("company_id", ws.companyId)
        .is("archived_at", null)
        .order("updated_at", { ascending: false })
        .limit(20);
      const s = normalizeSearch(search);
      if (s) q = q.ilike("search_text", `%${escapeLike(s)}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <span className={cn("truncate", !value && "text-muted-foreground")}>
            {value?.name ?? "Selecione um lead"}
          </span>
          <ChevronsUpDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) min-w-72 p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Buscar lead…" value={search} onValueChange={setSearch} />
          <CommandList>
            <CommandEmpty>{isFetching ? "Buscando…" : "Nenhum lead encontrado."}</CommandEmpty>
            <CommandGroup>
              {allowEmpty && value ? (
                <CommandItem
                  value="__none__"
                  onSelect={() => {
                    onChange(null);
                    setOpen(false);
                  }}
                >
                  Sem lead vinculado
                </CommandItem>
              ) : null}
              {data.map((l) => (
                <CommandItem
                  key={l.id}
                  value={l.id}
                  onSelect={() => {
                    onChange({ id: l.id, name: l.name });
                    setOpen(false);
                  }}
                >
                  <Check className={cn("size-4", value?.id === l.id ? "opacity-100" : "opacity-0")} />
                  <span className="truncate">
                    {l.name}
                    {l.customer_company ? (
                      <span className="text-muted-foreground"> · {l.customer_company}</span>
                    ) : null}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
