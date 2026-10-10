import Link from "next/link";
import { BarChart3, KanbanSquare, ListChecks, ShieldCheck, Shuffle, Users } from "lucide-react";
import { BrandMark } from "@/components/layout/brand-mark";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/session";
import { APP_NAME } from "@/lib/brand";

const FEATURES = [
  {
    icon: Users,
    title: "Leads organizados",
    text: "Cadastro com campos personalizados, aviso de duplicidade e histórico completo.",
  },
  {
    icon: Shuffle,
    title: "Distribuição justa",
    text: "Rodízio automático entre vendedores ativos ou atribuição manual.",
  },
  {
    icon: KanbanSquare,
    title: "Funil Kanban",
    text: "Etapas configuráveis, motivo de perda obrigatório e reabertura controlada.",
  },
  {
    icon: ListChecks,
    title: "Tarefas e alertas",
    text: "Prazos no fuso da empresa, atrasos destacados e notificações internas.",
  },
  {
    icon: BarChart3,
    title: "Relatórios confiáveis",
    text: "Faturamento, ticket médio, conversão e ranking com regras explícitas.",
  },
  {
    icon: ShieldCheck,
    title: "Isolamento por empresa",
    text: "Cada empresa enxerga apenas os próprios dados, garantido no banco.",
  },
];

export default async function LandingPage() {
  const user = await getCurrentUser();
  return (
    <div className="flex min-h-svh flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <BrandMark />
        <nav className="flex items-center gap-2">
          <ThemeToggle />
          {user ? (
            <Button asChild>
              <Link href="/app">Abrir o CRM</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost">
                <Link href="/entrar">Entrar</Link>
              </Button>
              <Button asChild>
                <Link href="/cadastro">Começar</Link>
              </Button>
            </>
          )}
        </nav>
      </header>
      <main className="flex-1">
        <section className="mx-auto max-w-6xl px-4 pt-16 pb-12 text-center sm:px-6 sm:pt-24">
          <h1 className="mx-auto max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            Gestão comercial simples para equipes de vendas
          </h1>
          <p className="text-muted-foreground mx-auto mt-5 max-w-2xl text-lg text-pretty">
            O {APP_NAME} reúne leads, funil, tarefas e vendas da sua empresa em um só lugar, com indicadores
            que você pode confiar.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/cadastro">Cadastrar minha empresa</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/entrar">Já tenho conta</Link>
            </Button>
          </div>
        </section>
        <section className="mx-auto grid max-w-6xl gap-4 px-4 pb-24 sm:grid-cols-2 sm:px-6 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="bg-card rounded-xl border p-5">
              <f.icon className="text-primary size-5" aria-hidden />
              <h2 className="mt-3 font-medium">{f.title}</h2>
              <p className="text-muted-foreground mt-1 text-sm">{f.text}</p>
            </div>
          ))}
        </section>
      </main>
      <footer className="text-muted-foreground border-t py-6 text-center text-sm">
        © {new Date().getFullYear()} {APP_NAME}
      </footer>
    </div>
  );
}
