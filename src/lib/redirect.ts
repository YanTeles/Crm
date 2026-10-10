// Evita open redirect: aceita apenas caminhos internos (ou URL do próprio site).
export function safeNextPath(
  value: string | null | undefined,
  siteOrigin?: string,
  fallback = "/app",
): string {
  if (!value) return fallback;
  let path = value;
  if (siteOrigin && /^https?:\/\//i.test(value)) {
    try {
      const url = new URL(value);
      if (url.origin !== new URL(siteOrigin).origin) return fallback;
      path = url.pathname + url.search;
    } catch {
      return fallback;
    }
  }
  if (!path.startsWith("/") || path.startsWith("//") || path.startsWith("/\\")) return fallback;
  return path;
}
