import Link from "next/link";
import type { ReactNode } from "react";
import { BrandMark } from "@/components/layout/brand-mark";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

export function AuthShell({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="bg-muted/40 flex min-h-svh flex-col">
      <header className="flex items-center justify-between px-4 py-3 sm:px-6">
        <Link href="/" className="rounded-md focus-visible:outline-2">
          <BrandMark />
        </Link>
        <ThemeToggle />
      </header>
      <main className="flex flex-1 items-center justify-center px-4 py-8">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-xl">{title}</CardTitle>
            {description ? <CardDescription>{description}</CardDescription> : null}
          </CardHeader>
          <CardContent>{children}</CardContent>
          {footer ? (
            <CardFooter className="text-muted-foreground justify-center text-sm">{footer}</CardFooter>
          ) : null}
        </Card>
      </main>
    </div>
  );
}
