import type { OperationResult } from "@venore/plugin-sdk";
import type { ChapterRecord, WorkRecord } from "../../../contracts/types";
import type { StoryIssue } from "../../../shared/story-validation";

export type WorkEditorChapter = ChapterRecord & { sceneCount: number };
export type WorkEditorView = {
  work: WorkRecord;
  coverUrl: string | null;
  chapters: WorkEditorChapter[];
  issues: StoryIssue[];
  // Leitura em voz alta: faixas esperadas (cena x idioma com texto, se a opção estiver ligada) e
  // quantas já estão prontas.
  speech: { expected: number; ready: number };
};
export type GetWorkInput = { workId: string };
export type GetWorkResult = OperationResult<WorkEditorView>;
