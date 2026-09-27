import type { OperationResult } from "@venore/plugin-sdk";

export type MoveChapterInput = { chapterId: string; direction: "up" | "down" };
export type MoveChapterCommand = MoveChapterInput & { actorId: string };
export type MoveChapterResult = OperationResult<{ workId: string }>;
