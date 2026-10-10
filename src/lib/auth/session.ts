import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Enums, Tables } from "@/types/database";

export type CurrentUser = { id: string; email: string; fullName: string };

// Usuário autenticado (JWT verificado via getClaims). Deduplicado por requisição.
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub;
  if (error || !sub) return null;

  const { data: profile } = await supabase.from("profiles").select("full_name, email").eq("id", sub).single();
  return {
    id: sub,
    email: profile?.email ?? String(data.claims.email ?? ""),
    fullName: profile?.full_name ?? "",
  };
});

export async function requireUser(next?: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(next ? `/entrar?next=${encodeURIComponent(next)}` : "/entrar");
  return user;
}

export type Membership = {
  id: string;
  role: Enums<"member_role">;
  status: Enums<"member_status">;
};

export type Workspace = {
  user: CurrentUser;
  company: Pick<
    Tables<"companies">,
    "id" | "name" | "slug" | "status" | "timezone" | "auto_distribution_enabled" | "suspended_reason"
  >;
  membership: Membership;
  isAdmin: boolean;
};

// Resolve a empresa pelo slug e o vínculo do usuário. O slug não é credencial:
// a visibilidade da empresa depende da RLS (membro ativo).
export const getWorkspace = cache(async (slug: string): Promise<Workspace | null> => {
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = await createClient();

  const { data: company } = await supabase
    .from("companies")
    .select("id, name, slug, status, timezone, auto_distribution_enabled, suspended_reason")
    .eq("slug", slug.toLowerCase())
    .maybeSingle();
  if (!company) return null;

  const { data: membership } = await supabase
    .from("company_members")
    .select("id, role, status")
    .eq("company_id", company.id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) return null;

  return { user, company, membership, isAdmin: membership.role === "admin" };
});

// Exige vínculo ativo em empresa ativa; usado em páginas e Server Actions.
export async function requireWorkspace(slug: string, opts: { admin?: boolean } = {}): Promise<Workspace> {
  await requireUser(`/app/${slug}`);
  const ws = await getWorkspace(slug);
  if (!ws) notFound();
  if (ws.company.status !== "active" || ws.membership.status !== "active") redirect(`/app/${slug}/bloqueado`);
  if (opts.admin && !ws.isAdmin) notFound();
  return ws;
}

export const isPlatformAdmin = cache(async (): Promise<boolean> => {
  const user = await getCurrentUser();
  if (!user) return false;
  const supabase = await createClient();
  const { data } = await supabase
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  return Boolean(data);
});
