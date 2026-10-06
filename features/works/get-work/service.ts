import { getSpeechAudio } from "@venore/plugin-sdk/speech";
import { resolveMediaUrls } from "../../../shared/resolve-media-urls";
import { speechItemsForWork, workSpeechScope } from "../../../shared/speech";
import { validateStory } from "../../../shared/story-validation";
import { findStoryRecords, findWorkById } from "./store";
import type { GetWorkInput, GetWorkResult } from "./types";

export async function getWork(input: GetWorkInput): Promise<GetWorkResult> {
  const work = await findWorkById(input.workId);
  if (!work) return { success: false, error: { code: "novels.work_not_found", message: "Obra não encontrada." } };

  const records = await findStoryRecords(work);
  const scope = workSpeechScope(work.id);
  const audio = work.speechEnabled ? await getSpeechAudio({ scopes: [scope] }) : null;
  const speech = {
    expected: work.speechEnabled ? speechItemsForWork(work, records.scenes).length : 0,
    ready: audio?.success ? (audio.data[scope]?.length ?? 0) : 0,
  };
  const urls = work.coverMediaId ? await resolveMediaUrls([work.coverMediaId]) : {};
  const sceneCounts = new Map<string, number>();
  for (const scene of records.scenes) sceneCounts.set(scene.chapterId, (sceneCounts.get(scene.chapterId) ?? 0) + 1);

  return {
    success: true,
    data: {
      work,
      coverUrl: work.coverMediaId ? (urls[work.coverMediaId] ?? null) : null,
      chapters: records.chapters.map((chapter) => ({ ...chapter, sceneCount: sceneCounts.get(chapter.id) ?? 0 })),
      issues: validateStory(records),
      speech,
    },
  };
}
