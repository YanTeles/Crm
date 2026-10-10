import { describe, expect, it } from "vitest";
import { normalizePhone, whatsappUrl } from "@/lib/phone";
import { parseMoney, formatCurrency } from "@/lib/format";
import { dayRange, isoToLocalInput, localInputToIso, periodRange, zonedToUtc } from "@/lib/dates";
import { errorCode, translateError } from "@/lib/errors";
import { safeNextPath } from "@/lib/redirect";

describe("telefone", () => {
  it("normaliza números brasileiros para E.164", () => {
    expect(normalizePhone("(11) 99999-0000")).toBe("+5511999990000");
    expect(normalizePhone("11 3333-4444")).toBe("+551133334444");
    expect(normalizePhone("+55 21 98888-7777")).toBe("+5521988887777");
  });
  it("mantém DDI estrangeiro", () => {
    expect(normalizePhone("+1 415 555 2671")).toBe("+14155552671");
  });
  it("rejeita entradas inválidas", () => {
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone("123")).toBeNull();
    expect(normalizePhone("abc")).toBeNull();
  });
  it("gera link do WhatsApp só com dígitos", () => {
    expect(whatsappUrl("+5511999990000")).toBe("https://wa.me/5511999990000");
  });
});

describe("dinheiro", () => {
  it("aceita formatos brasileiro e decimal", () => {
    expect(parseMoney("1.234,56")).toBe(1234.56);
    expect(parseMoney("R$ 10,5")).toBe(10.5);
    expect(parseMoney("1234.56")).toBe(1234.56);
    expect(parseMoney("0")).toBe(0);
  });
  it("rejeita mais de duas casas e texto", () => {
    expect(parseMoney("10,555")).toBeNull();
    expect(parseMoney("abc")).toBeNull();
    expect(parseMoney("")).toBeNull();
  });
  it("formata em BRL", () => {
    expect(formatCurrency(1234.5).replace(/\s/g, " ")).toBe("R$ 1.234,50");
  });
});

describe("fuso horário", () => {
  const tz = "America/Sao_Paulo";
  it("converte horário local de São Paulo para UTC", () => {
    expect(zonedToUtc(2026, 3, 10, 9, 0, tz).toISOString()).toBe("2026-03-10T12:00:00.000Z");
  });
  it("ida e volta de input datetime-local", () => {
    const iso = localInputToIso("2026-10-10T08:30", tz)!;
    expect(iso).toBe("2026-10-10T11:30:00.000Z");
    expect(isoToLocalInput(iso, tz)).toBe("2026-10-10T08:30");
  });
  it("'hoje' respeita o fuso da empresa perto da meia-noite", () => {
    // 02:00 UTC de 11/10 ainda é 10/10 em São Paulo
    const now = new Date("2026-10-11T02:00:00Z");
    const r = dayRange(tz, 0, now);
    expect(r.from.toISOString()).toBe("2026-10-10T03:00:00.000Z");
    expect(r.to.toISOString()).toBe("2026-10-11T03:00:00.000Z");
  });
  it("mês corrente e virada de ano", () => {
    const now = new Date("2026-01-15T12:00:00Z");
    const m = periodRange("this_month", tz, undefined, now);
    expect(m.from.toISOString()).toBe("2026-01-01T03:00:00.000Z");
    expect(m.to.toISOString()).toBe("2026-02-01T03:00:00.000Z");
    const last = periodRange("last_month", tz, undefined, now);
    expect(last.from.toISOString()).toBe("2025-12-01T03:00:00.000Z");
  });
  it("período personalizado inclui o último dia inteiro", () => {
    const r = periodRange("custom", tz, { from: "2026-05-01", to: "2026-05-31" });
    expect(r.from.toISOString()).toBe("2026-05-01T03:00:00.000Z");
    expect(r.to.toISOString()).toBe("2026-06-01T03:00:00.000Z");
  });
});

describe("erros", () => {
  it("extrai e traduz códigos do banco", () => {
    const err = { code: "P0001", message: "crm:last_admin" };
    expect(errorCode(err)).toBe("last_admin");
    expect(translateError(err)).toContain("administrador");
  });
  it("não vaza mensagens técnicas desconhecidas", () => {
    expect(translateError({ code: "XX000", message: "internal stack" })).toBe(
      "Não foi possível concluir a operação.",
    );
  });
});

describe("redirecionamento seguro", () => {
  it("aceita apenas caminhos internos", () => {
    expect(safeNextPath("/app/x")).toBe("/app/x");
    expect(safeNextPath("//evil.com")).toBe("/app");
    expect(safeNextPath("https://evil.com/app")).toBe("/app");
    expect(safeNextPath("/\\evil.com")).toBe("/app");
    expect(safeNextPath(null)).toBe("/app");
  });
  it("aceita URL absoluta do próprio site", () => {
    expect(safeNextPath("http://localhost:3000/onboarding", "http://localhost:3000")).toBe("/onboarding");
  });
});
