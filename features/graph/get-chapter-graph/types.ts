import type { OperationResult } from "@venore/plugin-sdk";
import type { CastMemberRecord, ChapterGraph, ChapterRecord, WorkRecord } from "../../../contracts/types";

export type ChapterGraphEditorView = {
  work: Pick<WorkRecord, "id" | "slug" | "title" | "defaultLocale" | "locales" | "variables" | "status">;
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
