import type { OperationResult } from "@venore/plugin-sdk";
import type { CatalogBadges, CoverFocus, LocalizedText, TagRecord, WorkTagGroupView } from "../../../contracts/types";

export type PublishedWorkCard = {
  id: string;
  slug: string;
  title: LocalizedText;
  subtitle: LocalizedText;
  synopsis: LocalizedText;
  defaultLocale: string;
  locales: string[];
  coverUrl: string | null;
  coverFocus: CoverFocus | null;
  chapterCount: number;
  publishedAt: Date | null;
  // Só os grupos marcados "no card do catálogo".
  tags: WorkTagGroupView[];
  // Alguma cena tem mais de uma escolha (selo "Interativa" x "Apenas texto").
  interactive: boolean;
};
// tag: slug do filtro (/novels?tag=terror).
export type ListPublishedWorksInput = { limit?: number; tag?: string };
export type PublishedWorksView = {
  works: PublishedWorkCard[];
  badges: CatalogBadges;
  // A tag do filtro, quando existe (título e descrição da página por tag).
  tag: TagRecord | null;
};
export type ListPublishedWorksResult = OperationResult<PublishedWorksView>;
