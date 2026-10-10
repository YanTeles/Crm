const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const integer = new Intl.NumberFormat("pt-BR");
const percent = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 1 });

export function formatCurrency(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  return currency.format(Number(value));
}

export function formatNumber(value: number | null | undefined): string {
  return value === null || value === undefined ? "—" : integer.format(value);
}

export function formatPercent(value: number | null | undefined): string {
  return value === null || value === undefined ? "—" : percent.format(value);
}

export function formatDate(value: string | Date | null | undefined, timeZone: string): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", { timeZone, dateStyle: "short" }).format(new Date(value));
}

export function formatDateTime(value: string | Date | null | undefined, timeZone: string): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", { timeZone, dateStyle: "short", timeStyle: "short" }).format(
    new Date(value),
  );
}

// Data calendário (YYYY-MM-DD) sem conversão de fuso.
export function formatPlainDate(value: string | null | undefined): string {
  if (!value) return "—";
  const [y, m, d] = value.split("-");
  return `${d}/${m}/${y}`;
}

export function formatMonth(value: string): string {
  const [y, m] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", { month: "short", year: "2-digit", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, 1)),
  );
}

// Converte "1.234,56" ou "1234.56" em número com 2 casas; null se inválido.
export function parseMoney(input: string): number | null {
  const cleaned = input.replace(/[R$\s]/g, "");
  if (!cleaned) return null;
  const normalized = cleaned.includes(",") ? cleaned.replace(/\./g, "").replace(",", ".") : cleaned;
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  return Number(normalized);
}
