import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CompanyForm } from "@/features/settings/components/company-form";
import { CustomFieldsManager } from "@/features/settings/components/custom-fields-manager";
import { OptionListManager } from "@/features/settings/components/option-list-manager";
import { StagesManager } from "@/features/settings/components/stages-manager";
import { getLookups } from "@/features/workspace/lookups";
import { requireWorkspace } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Configurações" };

export default async function SettingsPage({ params }: PageProps<"/app/[slug]/configuracoes">) {
  const { slug } = await params;
  const ws = await requireWorkspace(slug, { admin: true });
  const lookups = await getLookups(ws.company.id);
  const supabase = await createClient();

  // Contagem de leads por etapa (para avisar antes de remover).
  const counts = await Promise.all(
    lookups.stages
      .filter((s) => !s.archived_at)
      .map(async (s) => {
        const { count } = await supabase
          .from("leads")
          .select("id", { count: "exact", head: true })
          .eq("company_id", ws.company.id)
          .eq("stage_id", s.id);
        return [s.id, count ?? 0] as const;
      }),
  );

  return (
    <>
      <PageHeader title="Configurações" description="Ajustes da empresa, funil, campos e listas." />
      <Tabs defaultValue="empresa">
        <TabsList className="mb-4 flex-wrap">
          <TabsTrigger value="empresa">Empresa</TabsTrigger>
          <TabsTrigger value="funil">Funil</TabsTrigger>
          <TabsTrigger value="campos">Campos personalizados</TabsTrigger>
          <TabsTrigger value="origens">Origens</TabsTrigger>
          <TabsTrigger value="motivos">Motivos de perda</TabsTrigger>
        </TabsList>
        <TabsContent value="empresa">
          <CompanyForm />
        </TabsContent>
        <TabsContent value="funil">
          <StagesManager stages={lookups.stages} leadCounts={Object.fromEntries(counts)} />
        </TabsContent>
        <TabsContent value="campos">
          <CustomFieldsManager fields={lookups.customFields} />
        </TabsContent>
        <TabsContent value="origens">
          <OptionListManager
            table="lead_sources"
            items={lookups.sources}
            description="Origens disponíveis no cadastro de leads e no relatório de origem."
          />
        </TabsContent>
        <TabsContent value="motivos">
          <OptionListManager
            table="lost_reasons"
            items={lookups.reasons}
            description="Motivos exigidos ao marcar uma oportunidade como perdida. Pelo menos um motivo ativo é necessário."
          />
        </TabsContent>
      </Tabs>
    </>
  );
}
