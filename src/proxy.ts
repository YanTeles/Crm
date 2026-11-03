import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

// Roda antes de cada página abrir: mantém o login da pessoa ativo e protege as áreas restritas.
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

// Define em quais endereços isso acontece (ignora imagens e arquivos fixos, que não precisam de login).
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
