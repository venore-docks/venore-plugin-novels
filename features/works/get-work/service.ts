import { getSpeechState, getSpeechWorkerActivity } from "@venore/plugin-sdk/speech";
import { resolveMediaUrls } from "../../../shared/resolve-media-urls";
import { speechItemsForWork, workSpeechScope } from "../../../shared/speech";
import { validateStory, type StoryIssue } from "../../../shared/story-validation";
import { validateWorkTags } from "../../../shared/tag-catalog";
import { findStoryRecords, findTagCatalog, findWorkById, findWorkTagIds } from "./store";
import type { GetWorkInput, GetWorkResult } from "./types";

export async function getWork(input: GetWorkInput): Promise<GetWorkResult> {
  const work = await findWorkById(input.workId);
  if (!work) return { success: false, error: { code: "novels.work_not_found", message: "Obra não encontrada." } };

  const [records, tagCatalog, tagIds] = await Promise.all([findStoryRecords(work), findTagCatalog(), findWorkTagIds(work.id)]);
  const scope = workSpeechScope(work.id);
  // Áudio da obra contra o texto atual (faixa = cena x idioma): pronto, desatualizado, faltando,
  // na fila, gerando — e o que o worker do core está fazendo agora.
  const items = speechItemsForWork(work, records.scenes, records.cast);
  const [state, worker] = await Promise.all([getSpeechState({ scope, items }), getSpeechWorkerActivity()]);
  const speech = { state: state.success ? state.data : null, worker };
  const mediaIds = [work.coverMediaId, ...records.cast.map((member) => member.portraitMediaId)].filter((id): id is string => Boolean(id));
  const media = await resolveMediaUrls(mediaIds);
  const sceneCounts = new Map<string, number>();
  for (const scene of records.scenes) sceneCounts.set(scene.chapterId, (sceneCounts.get(scene.chapterId) ?? 0) + 1);
  const tagIssues: StoryIssue[] = validateWorkTags(tagCatalog.groups, tagCatalog.tags, tagIds, work.defaultLocale).map((issue) => ({
    severity: "error",
    code: issue.code,
    message: issue.message,
  }));

  return {
    success: true,
    data: {
      work,
      coverUrl: work.coverMediaId ? (media[work.coverMediaId] ?? null) : null,
      chapters: records.chapters.map((chapter) => ({ ...chapter, sceneCount: sceneCounts.get(chapter.id) ?? 0 })),
      issues: [...tagIssues, ...validateStory(records)],
      tagCatalog,
      tagIds,
      cast: records.cast,
      media,
      speech,
    },
  };
}
