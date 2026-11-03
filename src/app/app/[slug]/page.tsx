import { redirect } from "next/navigation";

// Ao abrir o endereço da empresa, vai direto para o painel.
export default async function WorkspaceIndex({ params }: PageProps<"/app/[slug]">) {
  const { slug } = await params;
  redirect(`/app/${slug}/dashboard`);
}
