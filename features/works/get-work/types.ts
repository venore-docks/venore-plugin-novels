import type { OperationResult } from "@venore/plugin-sdk";
import type { SpeechState, SpeechWorkerActivity } from "@venore/plugin-sdk/speech";
import type { ChapterRecord, WorkRecord } from "../../../contracts/types";
import type { StoryIssue } from "../../../shared/story-validation";

export type WorkEditorChapter = ChapterRecord & { sceneCount: number };
export type WorkEditorView = {
  work: WorkRecord;
  coverUrl: string | null;
  chapters: WorkEditorChapter[];
  issues: StoryIssue[];
  // Leitura em voz alta: estado das faixas (cena x idioma) contra o texto atual e a fase do worker.
  speech: { state: SpeechState | null; worker: SpeechWorkerActivity };
};
export type GetWorkInput = { workId: string };
export type GetWorkResult = OperationResult<WorkEditorView>;
