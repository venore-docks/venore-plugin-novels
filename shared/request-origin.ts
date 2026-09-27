import { headers } from "next/headers";

// Origem pública do request (Open Graph exige URL absoluta e o layout raiz não declara
// metadataBase). Mesma leitura de host/x-forwarded-* que o core e o erasto-league usam.
export async function resolveRequestOrigin(): Promise<string> {
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host")?.split(",")[0]?.trim() || headerList.get("host") || "localhost:3000";
  const proto =
    headerList.get("x-forwarded-proto")?.split(",")[0]?.trim() || (process.env.NODE_ENV === "production" ? "https" : "http");
  return `${proto}://${host}`;
}

export function absoluteUrl(origin: string, url: string): string {
  return /^https?:\/\//.test(url) ? url : `${origin}${url.startsWith("/") ? "" : "/"}${url}`;
}
