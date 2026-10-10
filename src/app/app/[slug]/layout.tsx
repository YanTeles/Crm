import Link from "next/link";
import { notFound } from "next/navigation";
import { Ban, PauseCircle } from "lucide-react";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { QueryProvider } from "@/components/layout/query-provider";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { UserMenu } from "@/components/layout/user-menu";
import { WorkspaceProvider } from "@/components/layout/workspace-context";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { NotificationBell } from "@/features/notifications/components/notification-bell";
import { getWorkspace, isPlatformAdmin, requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export default async function WorkspaceLayout({ children, params }: LayoutProps<"/app/[slug]">) {
  const { slug } = await params;
  const user = await requireUser(`/app/${slug}`);
  const ws = await getWorkspace(slug);
  if (!ws) notFound();

  if (ws.company.status !== "active" || ws.membership.status !== "active") {
    const suspended = ws.company.status !== "active";
    return (
      <main className="flex min-h-svh items-center justify-center p-6">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">{suspended ? <PauseCircle /> : <Ban />}</EmptyMedia>
            <EmptyTitle>{suspended ? "Empresa suspensa" : "Acesso desativado"}</EmptyTitle>
            <EmptyDescription>
              {suspended
                ? "O acesso operacional a esta empresa está suspenso. Os dados foram preservados. Entre em contato com o suporte da plataforma."
                : `Seu acesso à empresa ${ws.company.name} foi desativado por um administrador.`}
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button asChild variant="outline">
              <Link href="/app">Voltar</Link>
            </Button>
          </EmptyContent>
        </Empty>
      </main>
    );
  }

  const supabase = await createClient();
  const { data: memberships } = await supabase
    .from("company_members")
    .select("companies(name, slug)")
    .eq("user_id", user.id)
    .eq("status", "active");
  const companies = (memberships ?? []).flatMap((m) => (m.companies ? [m.companies] : []));
  const platformAdmin = await isPlatformAdmin();

  return (
    <WorkspaceProvider
      value={{
        companyId: ws.company.id,
        companyName: ws.company.name,
        slug: ws.company.slug,
        timezone: ws.company.timezone,
        isAdmin: ws.isAdmin,
        userId: user.id,
        userName: user.fullName,
        userEmail: user.email,
        autoDistribution: ws.company.auto_distribution_enabled,
      }}
    >
      <QueryProvider>
        <SidebarProvider>
          <AppSidebar companies={companies} platformAdmin={platformAdmin} />
          <SidebarInset>
            <header className="bg-background/95 supports-[backdrop-filter]:bg-background/70 sticky top-0 z-20 flex h-14 items-center gap-2 border-b px-3 backdrop-blur sm:px-4">
              <SidebarTrigger aria-label="Alternar menu" />
              <Separator orientation="vertical" className="mr-1 h-5" />
              <span className="truncate text-sm font-medium">{ws.company.name}</span>
              <div className="ml-auto flex items-center gap-1">
                <NotificationBell />
                <ThemeToggle />
                <UserMenu name={user.fullName} email={user.email} />
              </div>
            </header>
            <div className="flex-1 p-4 sm:p-6">{children}</div>
          </SidebarInset>
        </SidebarProvider>
      </QueryProvider>
    </WorkspaceProvider>
  );
}
