import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/redirect";

// Tipos de link enviados por e-mail que o sistema aceita.
const ALLOWED_TYPES: EmailOtpType[] = ["email", "signup", "recovery", "email_change", "invite", "magiclink"];

// Confirma links de e-mail (cadastro, recuperação, troca de e-mail) no servidor.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const defaultNext = type === "recovery" ? "/redefinir-senha" : "/app";
  const next = safeNextPath(searchParams.get("next"), origin, defaultNext);

  // Confere se o link do e-mail é válido; se for, leva a pessoa para a página certa.
  // Se não for, volta para o login com um aviso.
  if (tokenHash && type && ALLOWED_TYPES.includes(type)) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      return NextResponse.redirect(new URL(next, origin));
    }
  }

  return NextResponse.redirect(new URL("/entrar?erro=link", origin));
}
