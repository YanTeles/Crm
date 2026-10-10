"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { dbFail, fail, ok, type ActionResult } from "@/lib/action";
import { createClient } from "@/lib/supabase/server";

export async function setCompanyStatus(input: {
  companyId: string;
  status: "active" | "suspended";
  reason?: string;
}): Promise<ActionResult<undefined>> {
  if (!z.string().uuid().safeParse(input.companyId).success) return fail("Empresa inválida.");
  if (input.status === "suspended" && !input.reason?.trim()) return fail("Informe o motivo da suspensão.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_company_status", {
    p_company_id: input.companyId,
    p_status: input.status === "suspended" ? "suspended" : "active",
    p_reason: input.reason?.trim().slice(0, 500) ?? null,
  });
  if (error) return dbFail(error);
  revalidatePath("/plataforma");
  return ok(undefined, input.status === "suspended" ? "Empresa suspensa." : "Empresa reativada.");
}
