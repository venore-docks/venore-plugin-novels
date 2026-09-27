import type { OperationResult } from "@venore/plugin-sdk";
import type { ChapterGraph, ChapterRecord, WorkRecord } from "../../../contracts/types";

export type ChapterGraphEditorView = {
  work: Pick<WorkRecord, "id" | "slug" | "title" | "defaultLocale" | "locales" | "variables" | "status">;
  chapter: ChapterRecord;
  chapterNumber: number;
  chapterCount: number;
  graph: ChapterGraph;
  imageUrls: Record<string, string>;
};
export type GetChapterGraphInput = { workId: string; chapterId: string };
export type GetChapterGraphResult = OperationResult<ChapterGraphEditorView>;
