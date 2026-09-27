import type { OperationResult } from "@venore/plugin-sdk";
import type { ChapterRecord } from "../../../contracts/types";

export type CreateChapterInput = { workId: string; title: string };
export type CreateChapterCommand = CreateChapterInput & { actorId: string };
export type CreateChapterResult = OperationResult<ChapterRecord>;
