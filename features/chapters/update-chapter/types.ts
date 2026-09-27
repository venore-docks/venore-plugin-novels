import type { OperationResult } from "@venore/plugin-sdk";
import type { ChapterRecord, LocalizedText } from "../../../contracts/types";

export type UpdateChapterInput = { chapterId: string; title: LocalizedText };
export type UpdateChapterCommand = UpdateChapterInput & { actorId: string };
export type UpdateChapterResult = OperationResult<ChapterRecord>;
