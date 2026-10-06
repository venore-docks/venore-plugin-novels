import type { OperationResult } from "@venore/plugin-sdk";
import type { SpeechProgress, SpeechWorkerActivity } from "@venore/plugin-sdk/speech";
import type { ChapterRecord, WorkRecord } from "../../../contracts/types";
import type { StoryIssue } from "../../../shared/story-validation";

export type WorkEditorChapter = ChapterRecord & { sceneCount: number };
export type WorkEditorView = {
  work: WorkRecord;
  coverUrl: string | null;
  chapters: WorkEditorChapter[];
  issues: StoryIssue[];
  // Leitura em voz alta: faixas esperadas (cena x idioma com texto, se a opção estiver ligada), a
  // produção delas no core (prontas, na fila, gerando, com falha) e a fase do worker.
  speech: { expected: number; progress: SpeechProgress | null; worker: SpeechWorkerActivity | null };
};
export type GetWorkInput = { workId: string };
export type GetWorkResult = OperationResult<WorkEditorView>;
