import type { OperationResult } from "@venore/plugin-sdk";
import type { ChapterRecord, WorkRecord } from "../../../contracts/types";
import type { StoryIssue } from "../../../shared/story-validation";

export type WorkEditorChapter = ChapterRecord & { sceneCount: number };
export type WorkEditorView = {
  work: WorkRecord;
  coverUrl: string | null;
  chapters: WorkEditorChapter[];
  issues: StoryIssue[];
};
export type GetWorkInput = { workId: string };
export type GetWorkResult = OperationResult<WorkEditorView>;
