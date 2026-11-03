import { parsePhoneNumberFromString } from "libphonenumber-js";

// Normaliza para E.164 (padrão BR quando o número vem sem DDI).
export function normalizePhone(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  const parsed = parsePhoneNumberFromString(value, "BR");
  if (!parsed || !parsed.isPossible()) return null;
  return parsed.number;
}

// Mostra o telefone de forma fácil de ler, como (11) 99999-8888.
export function formatPhone(e164: string): string {
  const parsed = parsePhoneNumberFromString(e164);
  if (!parsed) return e164;
  return parsed.country === "BR" ? parsed.formatNational() : parsed.formatInternational();
}

// Link para abrir conversa no WhatsApp (sem envio automático).
export function whatsappUrl(e164: string): string {
  return `https://wa.me/${e164.replace(/\D/g, "")}`;
}
