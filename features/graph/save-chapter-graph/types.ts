import type { OperationResult } from "@venore/plugin-sdk";
import type { ChapterGraph } from "../../../contracts/types";
import type { StoryIssue } from "../../../shared/story-validation";

export type SaveChapterGraphInput = { workId: string; chapterId: string; graph: unknown };
export type SaveChapterGraphCommand = { workId: string; chapterId: string; graph: ChapterGraph; actorId: string };
// Devolve os problemas da obra inteira depois de salvar, pro editor mostrar sem outra ida ao
// servidor. Salvar rascunho com erro é permitido; publicar, não.
export type SaveChapterGraphResult = OperationResult<{ savedAt: Date; issues: StoryIssue[] }>;
