import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BrandMark } from "@/components/layout/brand-mark";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ResetPasswordForm } from "@/features/auth/components/password-forms";
import { ProfileNameForm } from "@/features/profile/profile-name-form";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Meu perfil" };

export default async function ProfilePage() {
  const user = await requireUser("/perfil");
  return (
    <div className="min-h-svh">
      <header className="flex items-center justify-between border-b px-4 py-3 sm:px-6">
        <Link href="/app">
          <BrandMark />
        </Link>
        <ThemeToggle />
      </header>
      <main className="mx-auto max-w-xl space-y-6 p-4 sm:p-6">
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link href="/app">
            <ArrowLeft /> Voltar ao CRM
          </Link>
        </Button>
        <Card>
          <CardHeader>
            <CardTitle>Dados pessoais</CardTitle>
            <CardDescription>E-mail de acesso: {user.email}</CardDescription>
          </CardHeader>
          <CardContent>
            <ProfileNameForm defaultName={user.fullName} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Alterar senha</CardTitle>
            <CardDescription>
              Por segurança, pode ser necessário entrar novamente antes de trocar a senha.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResetPasswordForm />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
