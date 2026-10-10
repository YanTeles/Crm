"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { dbFail, fail, invalid, ok, type ActionResult } from "@/lib/action";
import { env } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

const uuid = z.string().uuid();
const role = z.enum(["admin", "seller"]);

function refresh(slug: string) {
  if (/^[a-z0-9-]{3,48}$/.test(slug)) revalidatePath(`/app/${slug}`, "layout");
}

const inviteSchema = z.object({
  companyId: uuid,
  email: z.string().trim().toLowerCase().email("Informe um e-mail válido.").max(254),
  role,
});

// Retorna o link do convite (o token só existe em claro nesta resposta).
export async function createInvitation(
  input: z.input<typeof inviteSchema> & { slug: string },
): Promise<ActionResult<{ link: string; expiresAt: string }>> {
  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_invitation", {
    p_company_id: parsed.data.companyId,
    p_email: parsed.data.email,
    p_role: parsed.data.role,
  });
  if (error || !data?.[0]) return dbFail(error);
  refresh(input.slug);
  return ok(
    { link: `${env.siteUrl}/convite/${data[0].token}`, expiresAt: data[0].expires_at },
    "Convite criado.",
  );
}

export async function revokeInvitation(input: {
  invitationId: string;
  slug: string;
}): Promise<ActionResult<undefined>> {
  if (!uuid.safeParse(input.invitationId).success) return fail("Convite inválido.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_invitation", { p_invitation_id: input.invitationId });
  if (error) return dbFail(error);
  refresh(input.slug);
  return ok(undefined, "Convite revogado.");
}

export async function setMemberRole(input: {
  memberId: string;
  role: "admin" | "seller";
  slug: string;
}): Promise<ActionResult<undefined>> {
  if (!uuid.safeParse(input.memberId).success || !role.safeParse(input.role).success)
    return fail("Dados inválidos.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_member_role", {
    p_member_id: input.memberId,
    p_role: input.role,
  });
  if (error) return dbFail(error);
  refresh(input.slug);
  return ok(undefined, input.role === "admin" ? "Promovido a administrador." : "Alterado para vendedor.");
}

export async function setMemberStatus(input: {
  memberId: string;
  status: "active" | "inactive";
  slug: string;
}): Promise<ActionResult<undefined>> {
  if (!uuid.safeParse(input.memberId).success) return fail("Dados inválidos.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_member_status", {
    p_member_id: input.memberId,
    p_status: input.status === "inactive" ? "inactive" : "active",
  });
  if (error) return dbFail(error);
  refresh(input.slug);
  return ok(undefined, input.status === "inactive" ? "Acesso desativado." : "Acesso reativado.");
}
