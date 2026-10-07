import { beginOperation, endOperation } from "@venore/plugin-sdk/observability";
import type { ChapterGraph } from "../../../contracts/types";
import { normalizeLocalizedText } from "../../../shared/localized-text";
import { normalizeBlocks } from "../../../shared/scene-blocks";
import { blockingIssueForPublished } from "../../../shared/published-guard";
import { validateStory } from "../../../shared/story-validation";
import {
  findChapterWithWork,
  findForeignChoiceIds,
  findForeignSceneIds,
  findStoryRecords,
  replaceChapterGraph,
} from "./store";
import type { SaveChapterGraphCommand, SaveChapterGraphResult } from "./types";

function normalizeGraph(graph: ChapterGraph, locales: string[]): ChapterGraph {
  return {
    startSceneId: graph.startSceneId,
    scenes: graph.scenes.map((scene) => ({
      ...scene,
      label: scene.label.trim(),
      blocks: normalizeBlocks(scene.blocks, locales),
      endingTitle: scene.isEnding ? normalizeLocalizedText(scene.endingTitle, locales) : {},
    })),
    choices: graph.choices.map((choice) => ({ ...choice, label: normalizeLocalizedText(choice.label, locales) })),
  };
}

export async function saveChapterGraph(command: SaveChapterGraphCommand): Promise<SaveChapterGraphResult> {
  const handle = beginOperation({
    useCase: "novels.save-chapter-graph",
    actor: { id: command.actorId, type: "user" },
    kind: "write",
  });
  const fail = (code: string, message: string): SaveChapterGraphResult => {
    const error = { code, message };
    endOperation(handle, { success: false, error });
    return { success: false, error };
  };

  const found = await findChapterWithWork(command.chapterId);
  if (!found || found.work.id !== command.workId) return fail("novels.chapter_not_found", "Capítulo não encontrado.");

  const graph = normalizeGraph(command.graph, found.work.locales);
  const [foreignScenes, foreignChoices] = await Promise.all([
    findForeignSceneIds(graph.scenes.map((scene) => scene.id), found.chapter.id),
    findForeignChoiceIds(graph.choices.map((choice) => choice.id), found.chapter.id),
  ]);
  if (foreignScenes.length > 0 || foreignChoices.length > 0) {
    return fail("novels.foreign_ids", "Grafo inválido: ids pertencem a outro capítulo. Recarregue o editor.");
  }

  const records = await findStoryRecords(found.work);
  const chapterSceneIds = new Set(
    records.scenes.filter((scene) => scene.chapterId === found.chapter.id).map((scene) => scene.id),
  );
  const nextStory = {
    ...records,
    chapters: records.chapters.map((chapter) =>
      chapter.id === found.chapter.id ? { ...chapter, startSceneId: graph.startSceneId } : chapter,
    ),
    scenes: [
      ...records.scenes.filter((scene) => scene.chapterId !== found.chapter.id),
      ...graph.scenes.map((scene) => ({ ...scene, workId: found.work.id, chapterId: found.chapter.id })),
    ],
    choices: [
      ...records.choices.filter((choice) => !chapterSceneIds.has(choice.sceneId)),
      ...graph.choices,
    ],
  };

  const blocking = blockingIssueForPublished(found.work.status, nextStory);
  if (blocking) {
    return fail("novels.would_break_published", `A obra está publicada e ficaria com erro: ${blocking}`);
  }

  const savedAt = await replaceChapterGraph(found.work.id, found.chapter.id, graph);
  endOperation(handle, { success: true, detail: { scenes: graph.scenes.length, choices: graph.choices.length } });
  return { success: true, data: { savedAt, issues: validateStory(nextStory) } };
}
