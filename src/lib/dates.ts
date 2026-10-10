// Conversões entre horário local de um fuso (IANA) e instantes UTC, sem
// dependências externas. Usado para "hoje", períodos de relatório e prazos.

type Parts = { year: number; month: number; day: number; hour: number; minute: number; second: number };

function partsInZone(date: Date, timeZone: string): Parts {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const map = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
  };
}

function offsetMs(date: Date, timeZone: string): number {
  const p = partsInZone(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

// Instante UTC correspondente a uma data/hora local no fuso informado.
export function zonedToUtc(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  timeZone: string,
): Date {
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const first = new Date(guess.getTime() - offsetMs(guess, timeZone));
  // Segunda passada corrige transições de horário de verão.
  return new Date(guess.getTime() - offsetMs(first, timeZone));
}

export function todayInZone(
  timeZone: string,
  now = new Date(),
): { year: number; month: number; day: number } {
  const p = partsInZone(now, timeZone);
  return { year: p.year, month: p.month, day: p.day };
}

// "YYYY-MM-DDTHH:mm" (input datetime-local) no fuso → ISO UTC.
export function localInputToIso(value: string, timeZone: string): string | null {
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return null;
  return zonedToUtc(+m[1], +m[2], +m[3], +m[4], +m[5], timeZone).toISOString();
}

// ISO UTC → "YYYY-MM-DDTHH:mm" no fuso (para preencher inputs).
export function isoToLocalInput(iso: string, timeZone: string): string {
  const p = partsInZone(new Date(iso), timeZone);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

// "YYYY-MM-DD" (input date) no fuso → início do dia em ISO UTC.
export function localDateToIso(value: string, timeZone: string, endOfDay = false): string | null {
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const start = zonedToUtc(+m[1], +m[2], +m[3], 0, 0, timeZone);
  if (!endOfDay) return start.toISOString();
  return zonedToUtc(+m[1], +m[2], +m[3] + 1, 0, 0, timeZone).toISOString();
}

export type DayRange = { from: Date; to: Date };

export function dayRange(timeZone: string, offsetDays = 0, now = new Date()): DayRange {
  const t = todayInZone(timeZone, now);
  return {
    from: zonedToUtc(t.year, t.month, t.day + offsetDays, 0, 0, timeZone),
    to: zonedToUtc(t.year, t.month, t.day + offsetDays + 1, 0, 0, timeZone),
  };
}

export type PeriodKey = "this_month" | "last_month" | "last_90" | "this_year" | "last_12m" | "custom";

export function periodRange(
  key: PeriodKey,
  timeZone: string,
  custom?: { from?: string; to?: string },
  now = new Date(),
): DayRange {
  const t = todayInZone(timeZone, now);
  const at = (y: number, m: number, d: number) => zonedToUtc(y, m, d, 0, 0, timeZone);
  switch (key) {
    case "last_month":
      return { from: at(t.year, t.month - 1, 1), to: at(t.year, t.month, 1) };
    case "last_90":
      return { from: at(t.year, t.month, t.day - 89), to: at(t.year, t.month, t.day + 1) };
    case "this_year":
      return { from: at(t.year, 1, 1), to: at(t.year + 1, 1, 1) };
    case "last_12m":
      return { from: at(t.year, t.month - 11, 1), to: at(t.year, t.month + 1, 1) };
    case "custom": {
      const from = custom?.from && localDateToIso(custom.from, timeZone);
      const to = custom?.to && localDateToIso(custom.to, timeZone, true);
      if (from && to && from < to) return { from: new Date(from), to: new Date(to) };
      return periodRange("this_month", timeZone, undefined, now);
    }
    case "this_month":
    default:
      return { from: at(t.year, t.month, 1), to: at(t.year, t.month + 1, 1) };
  }
}
