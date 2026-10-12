import type { OperationResult } from "@venore/plugin-sdk";
import type { Creature, Item } from "../../../contracts/game";
import type { CastMemberRecord, ChapterGraph, ChapterRecord, WorkRecord } from "../../../contracts/types";

export type ChapterGraphEditorView = {
  work: Pick<WorkRecord, "id" | "slug" | "title" | "defaultLocale" | "locales" | "variables" | "status" | "gameSystem">;
  // Catálogo da obra (efeitos e condições escolhem item/criatura de uma lista).
  items: Item[];
  creatures: Creature[];
  // Todas as cenas da obra (gatilho "ao zerar" pode ir para outro capítulo).
  allScenes: { id: string; label: string; chapterId: string }[];
  chapter: ChapterRecord;
  cast: CastMemberRecord[];
  chapterNumber: number;
  chapterCount: number;
  graph: ChapterGraph;
  // URL de toda mídia usada no capítulo (blocos) e dos retratos do elenco.
  imageUrls: Record<string, string>;
};
export type GetChapterGraphInput = { workId: string; chapterId: string };
export type GetChapterGraphResult = OperationResult<ChapterGraphEditorView>;
