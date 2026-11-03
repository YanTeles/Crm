import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";

// Áreas do sistema que só podem ser abertas por quem fez login.
const PROTECTED_PREFIXES = ["/app", "/onboarding", "/plataforma", "/perfil"];

// Renova a sessão a cada requisição e faz o redirecionamento otimista de
// rotas protegidas. A autorização real acontece no servidor e na RLS.
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  // Prepara a conexão com o banco usando os dados de login guardados no navegador.
  const supabase = createServerClient(env.supabaseUrl, env.supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
      },
    },
  });

  // Não inserir lógica entre a criação do cliente e getClaims().
  const { data } = await supabase.auth.getClaims();
  const isAuthenticated = Boolean(data?.claims?.sub);

  // Se a pessoa não está logada e tenta abrir uma área restrita, manda para a tela de login,
  // lembrando qual página ela queria abrir.
  const { pathname, search } = request.nextUrl;
  if (!isAuthenticated && PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    const url = request.nextUrl.clone();
    url.pathname = "/entrar";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  return response;
}
