"use client";

import { createContext, useContext } from "react";

// Informações da empresa e da pessoa logada que ficam disponíveis para toda a tela.
export type WorkspaceInfo = {
  companyId: string;
  companyName: string;
  slug: string;
  timezone: string;
  isAdmin: boolean;
  userId: string;
  userName: string;
  userEmail: string;
  autoDistribution: boolean;
};

// Lugar onde essas informações ficam guardadas.
const WorkspaceContext = createContext<WorkspaceInfo | null>(null);

// Envolve as telas do sistema e entrega a elas essas informações.
export function WorkspaceProvider({ value, children }: { value: WorkspaceInfo; children: React.ReactNode }) {
  return <WorkspaceContext value={value}>{children}</WorkspaceContext>;
}

// Permite que qualquer parte da tela leia essas informações.
export function useWorkspace(): WorkspaceInfo {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace fora do WorkspaceProvider");
  return ctx;
}
