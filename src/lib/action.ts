import type { z } from "zod";
import { translateError, type DbError } from "@/lib/errors";

// Formato padrão da resposta de qualquer operação: ou deu certo (com os dados),
// ou deu errado (com a mensagem do erro).
export type ActionResult<T = undefined> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

// Atalhos para montar uma resposta de sucesso ou de erro.
export function ok<T>(data: T, message?: string): ActionResult<T> {
  return { ok: true, data, message };
}

export function fail(error: string, fieldErrors?: Record<string, string[]>): ActionResult<never> {
  return { ok: false, error, fieldErrors };
}

// Quando o erro vem do banco, guarda o detalhe para a equipe técnica
// e mostra ao usuário uma mensagem fácil de entender.
export function dbFail(error: DbError, fallback?: string): ActionResult<never> {
  if (error) console.error("[db]", error.code, error.message);
  return fail(translateError(error, fallback));
}

// Quando o formulário tem campos preenchidos errado, junta a mensagem de cada campo
// para mostrar logo abaixo dele.
export function invalid(error: z.ZodError): ActionResult<never> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return fail(error.issues[0]?.message ?? "Dados inválidos.", fieldErrors);
}
