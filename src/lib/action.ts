import type { z } from "zod";
import { translateError, type DbError } from "@/lib/errors";

export type ActionResult<T = undefined> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export function ok<T>(data: T, message?: string): ActionResult<T> {
  return { ok: true, data, message };
}

export function fail(error: string, fieldErrors?: Record<string, string[]>): ActionResult<never> {
  return { ok: false, error, fieldErrors };
}

export function dbFail(error: DbError, fallback?: string): ActionResult<never> {
  if (error) console.error("[db]", error.code, error.message);
  return fail(translateError(error, fallback));
}

export function invalid(error: z.ZodError): ActionResult<never> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return fail(error.issues[0]?.message ?? "Dados inválidos.", fieldErrors);
}
