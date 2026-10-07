import type { WorkTags } from "../contracts/types";

// Tags da obra em duas categorias:
// - informativa: gênero (lista fixa + tags livres), avisos de conteúdo e classificação indicativa;
//   o formato (interativa x só texto) é calculado do grafo, não escolhido.
// - produção: como cada parte foi feita — texto, imagens, revisão, tradução — por humanos, por IA
//   ou com auxílio de IA. Uma escolha por parte (nunca "imagens por IA" e "por humanos" juntas).
//   O áudio (leitura em voz alta) entra sozinho quando existe: é sempre gerado por IA.
// A interface do plugin é pt-BR; as chaves ficam estáveis para filtro e tradução futura.

export const GENRES = {
  aventura: "Aventura",
  acao: "Ação",
  fantasia: "Fantasia",
  ficcao_cientifica: "Ficção científica",
  terror: "Terror",
  suspense: "Suspense",
  misterio: "Mistério",
  romance: "Romance",
  drama: "Drama",
  comedia: "Comédia",
  historico: "Histórico",
  cotidiano: "Cotidiano",
  rpg: "RPG",
  fanfic: "Fanfic",
} as const;

export const CONTENT_WARNINGS = {
  violencia: "Violência",
  sangue: "Sangue e gore",
  sexual: "Conteúdo sexual",
  nudez: "Nudez",
  linguagem: "Linguagem forte",
  drogas: "Álcool e drogas",
  suicidio: "Suicídio e automutilação",
  abuso: "Abuso",
  morte: "Morte",
  discriminacao: "Discriminação",
} as const;

// Classificação indicativa (ClassInd).
export const RATINGS = {
  livre: "Livre",
  "10": "10+",
  "12": "12+",
  "14": "14+",
  "16": "16+",
  "18": "18+",
} as const;

export const PRODUCTION_PARTS = {
  text: { label: "Texto", human: "Texto feito por humanos", ai: "Texto feito por IA", ai_assisted: "Texto com auxílio de IA" },
  images: {
    label: "Imagens",
    human: "Imagens feitas por humanos",
    ai: "Imagens feitas por IA",
    ai_assisted: "Imagens com auxílio de IA",
  },
  review: {
    label: "Revisão",
    human: "Revisão feita por humanos",
    ai: "Revisão feita por IA",
    ai_assisted: "Revisão com auxílio de IA",
  },
  translation: {
    label: "Tradução",
    human: "Tradução feita por humanos",
    ai: "Tradução feita por IA",
    ai_assisted: "Tradução com auxílio de IA",
  },
} as const;
export const PRODUCTION_ORIGINS = ["human", "ai", "ai_assisted"] as const;
export const PRODUCTION_ORIGIN_LABELS = { human: "Humanos", ai: "IA", ai_assisted: "Humanos com auxílio de IA" } as const;

export const MAX_CUSTOM_TAGS = 5;
export const MAX_CUSTOM_TAG_LENGTH = 30;
export const AUDIO_TAG = "Áudio gerado por IA";

export type GenreKey = keyof typeof GENRES;
export type ContentWarningKey = keyof typeof CONTENT_WARNINGS;
export type RatingKey = keyof typeof RATINGS;
export type ProductionPart = keyof typeof PRODUCTION_PARTS;
export type ProductionOrigin = (typeof PRODUCTION_ORIGINS)[number];

export const EMPTY_TAGS: WorkTags = { genres: [], customGenres: [], content: [], rating: null, production: {} };

const has = <T extends object>(record: T, key: unknown): key is keyof T => typeof key === "string" && Object.hasOwn(record, key);

// Normaliza o que vem do banco (obra antiga = {}) ou do formulário: descarta chave desconhecida,
// repetida ou vazia; tag livre aparada, sem duplicar (ignorando maiúsculas) e no limite.
export function normalizeTags(raw: unknown): WorkTags {
  const value = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const list = (input: unknown) => (Array.isArray(input) ? input : []);
  const unique = <T,>(items: T[]) => [...new Set(items)];
  const custom: string[] = [];
  for (const item of list(value.customGenres)) {
    const tag = typeof item === "string" ? item.trim().replace(/\s+/g, " ").slice(0, MAX_CUSTOM_TAG_LENGTH) : "";
    if (tag && !custom.some((existing) => existing.toLowerCase() === tag.toLowerCase())) custom.push(tag);
  }
  const productionRaw = (value.production && typeof value.production === "object" ? value.production : {}) as Record<string, unknown>;
  const production: WorkTags["production"] = {};
  for (const part of Object.keys(PRODUCTION_PARTS) as ProductionPart[]) {
    const origin = productionRaw[part];
    if (typeof origin === "string" && (PRODUCTION_ORIGINS as readonly string[]).includes(origin)) {
      production[part] = origin as ProductionOrigin;
    }
  }
  return {
    genres: unique(list(value.genres).filter((key): key is GenreKey => has(GENRES, key))),
    customGenres: custom.slice(0, MAX_CUSTOM_TAGS),
    content: unique(list(value.content).filter((key): key is ContentWarningKey => has(CONTENT_WARNINGS, key))),
    rating: has(RATINGS, value.rating) ? (value.rating as RatingKey) : null,
    production,
  };
}

export type TagGroup = { label: string; tags: string[] };

// Tags prontas para mostrar, em grupos. `interactive`: a obra tem cena com mais de uma escolha.
// `hasAudio`: há leitura em voz alta pronta. `multilingual`: mais de um idioma (tradução só aparece
// assim).
export function describeTags(
  tags: WorkTags,
  context: { interactive: boolean; hasAudio?: boolean; multilingual?: boolean },
): { info: TagGroup[]; production: TagGroup[] } {
  const info: TagGroup[] = [];
  const genres = [...tags.genres.map((key) => GENRES[key]), ...tags.customGenres];
  if (genres.length > 0) info.push({ label: "Gênero", tags: genres });
  info.push({ label: "Formato", tags: [context.interactive ? "Interativa" : "Apenas texto"] });
  if (tags.rating) info.push({ label: "Classificação", tags: [RATINGS[tags.rating]] });
  if (tags.content.length > 0) info.push({ label: "Conteúdo", tags: tags.content.map((key) => CONTENT_WARNINGS[key]) });

  const production: string[] = [];
  for (const part of Object.keys(PRODUCTION_PARTS) as ProductionPart[]) {
    const origin = tags.production[part];
    if (!origin || (part === "translation" && !context.multilingual)) continue;
    production.push(PRODUCTION_PARTS[part][origin]);
  }
  if (context.hasAudio) production.push(AUDIO_TAG);
  return { info, production: production.length > 0 ? [{ label: "Produção", tags: production }] : [] };
}
