"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Building2,
  Check,
  ChevronsUpDown,
  KanbanSquare,
  LayoutDashboard,
  ListChecks,
  Receipt,
  Settings,
  ShieldCheck,
  Users,
  UserSquare2,
} from "lucide-react";
import { BrandMark } from "@/components/layout/brand-mark";
import { useWorkspace } from "@/components/layout/workspace-context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";

type Company = { name: string; slug: string };
type NavItem = { href: string; label: string; icon: React.ComponentType };

export function AppSidebar({ companies, platformAdmin }: { companies: Company[]; platformAdmin: boolean }) {
  const ws = useWorkspace();
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  const base = `/app/${ws.slug}`;

  const main: NavItem[] = [
    { href: `${base}/dashboard`, label: "Dashboard", icon: LayoutDashboard },
    { href: `${base}/leads`, label: ws.isAdmin ? "Leads" : "Meus leads", icon: UserSquare2 },
    { href: `${base}/funil`, label: "Funil", icon: KanbanSquare },
    { href: `${base}/tarefas`, label: ws.isAdmin ? "Tarefas" : "Minhas tarefas", icon: ListChecks },
    { href: `${base}/vendas`, label: ws.isAdmin ? "Vendas" : "Minhas vendas", icon: Receipt },
    { href: `${base}/relatorios`, label: ws.isAdmin ? "Relatórios" : "Meus resultados", icon: BarChart3 },
  ];
  const admin: NavItem[] = [
    { href: `${base}/equipe`, label: "Equipe", icon: Users },
    { href: `${base}/configuracoes`, label: "Configurações", icon: Settings },
  ];

  const renderItem = (i: NavItem) => {
    const active = pathname === i.href || pathname.startsWith(`${i.href}/`);
    return (
      <SidebarMenuItem key={i.href}>
        <SidebarMenuButton asChild isActive={active} tooltip={i.label}>
          <Link href={i.href} onClick={() => setOpenMobile(false)} aria-current={active ? "page" : undefined}>
            <i.icon />
            <span>{i.label}</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent">
                  <BrandMark compact />
                  <span className="grid flex-1 text-left leading-tight">
                    <span className="truncate font-medium">{ws.companyName}</span>
                    <span className="text-muted-foreground truncate text-xs">
                      {ws.isAdmin ? "Administrador" : "Vendedor"}
                    </span>
                  </span>
                  <ChevronsUpDown className="ml-auto" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-64" align="start">
                <DropdownMenuLabel>Empresas</DropdownMenuLabel>
                {companies.map((c) => (
                  <DropdownMenuItem key={c.slug} asChild>
                    <Link href={`/app/${c.slug}/dashboard`}>
                      <Building2 />
                      <span className="flex-1 truncate">{c.name}</span>
                      {c.slug === ws.slug ? <Check className="size-4" /> : null}
                    </Link>
                  </DropdownMenuItem>
                ))}
                {platformAdmin ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href="/plataforma">
                        <ShieldCheck /> Administração da plataforma
                      </Link>
                    </DropdownMenuItem>
                  </>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Comercial</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{main.map(renderItem)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {ws.isAdmin ? (
          <SidebarGroup>
            <SidebarGroupLabel>Gestão</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>{admin.map(renderItem)}</SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : null}
      </SidebarContent>
      <SidebarFooter />
      <SidebarRail />
    </Sidebar>
  );
}
