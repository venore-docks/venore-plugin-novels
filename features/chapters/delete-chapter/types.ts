import type { OperationResult } from "@venore/plugin-sdk";

export type DeleteChapterInput = { chapterId: string };
export type DeleteChapterCommand = DeleteChapterInput & { actorId: string };
export type DeleteChapterResult = OperationResult<{ workId: string }>;
