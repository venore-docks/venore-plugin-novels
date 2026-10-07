import type { OperationResult } from "@venore/plugin-sdk";
import type { LocalizedText, WorkTags } from "../../../contracts/types";

export type PublishedWorkCard = {
  id: string;
  slug: string;
  title: LocalizedText;
  synopsis: LocalizedText;
  defaultLocale: string;
  locales: string[];
  coverUrl: string | null;
  chapterCount: number;
  publishedAt: Date | null;
  tags: WorkTags;
  // Alguma cena tem mais de uma escolha (tag "Interativa" x "Apenas texto").
  interactive: boolean;
};
export type ListPublishedWorksInput = { limit?: number };
export type ListPublishedWorksResult = OperationResult<PublishedWorkCard[]>;
