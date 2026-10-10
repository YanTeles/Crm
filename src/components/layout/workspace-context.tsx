"use client";

import { createContext, useContext } from "react";

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

const WorkspaceContext = createContext<WorkspaceInfo | null>(null);

export function WorkspaceProvider({ value, children }: { value: WorkspaceInfo; children: React.ReactNode }) {
  return <WorkspaceContext value={value}>{children}</WorkspaceContext>;
}

export function useWorkspace(): WorkspaceInfo {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace fora do WorkspaceProvider");
  return ctx;
}
