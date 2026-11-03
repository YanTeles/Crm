"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

// Controla o tema claro/escuro do sistema e lembra a escolha da pessoa.
export function ThemeProvider(props: React.ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props} />;
}
