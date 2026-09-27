import type { LocalizedText } from "../contracts/types";

// Texto no locale pedido; sem tradução, cai pro locale padrão da obra e depois pro primeiro
// valor não vazio. Nunca devolve undefined, pra UI não precisar de `?? ""` em todo lugar.
export function pickText(text: LocalizedText | null | undefined, locale: string, fallbackLocale: string): string {
  if (!text) return "";
  const direct = text[locale]?.trim();
  if (direct) return text[locale];
  const fallback = text[fallbackLocale]?.trim();
  if (fallback) return text[fallbackLocale];
  return Object.values(text).find((value) => value.trim().length > 0) ?? "";
}

// Parágrafos estilo livro: separados por linha em branco no texto cru.
export function splitParagraphs(body: string): string[] {
  return body
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);
}

export function normalizeLocalizedText(text: LocalizedText, locales: string[]): LocalizedText {
  const normalized: LocalizedText = {};
  for (const locale of locales) {
    const value = text[locale];
    if (typeof value === "string" && value.trim().length > 0) normalized[locale] = value.trim();
  }
  return normalized;
}
