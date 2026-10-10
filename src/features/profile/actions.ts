"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { dbFail, invalid, ok, type ActionResult } from "@/lib/action";
import { createClient } from "@/lib/supabase/server";

export async function updateProfileName(input: { fullName: string }): Promise<ActionResult<undefined>> {
  const parsed = z
    .object({ fullName: z.string().trim().min(2, "Informe seu nome.").max(120) })
    .safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const uid = claims?.claims?.sub;
  if (!uid) return { ok: false, error: "Sessão expirada." };
  const { error } = await supabase.from("profiles").update({ full_name: parsed.data.fullName }).eq("id", uid);
  if (error) return dbFail(error);
  await supabase.auth.updateUser({ data: { full_name: parsed.data.fullName } });
  revalidatePath("/", "layout");
  return ok(undefined, "Nome atualizado.");
}
