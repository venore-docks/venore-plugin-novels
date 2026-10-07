import { toChapterGraphScene } from "../../../shared/build-story";
import { resolveMediaUrls } from "../../../shared/resolve-media-urls";
import { sceneMediaIds } from "../../../shared/scene-blocks";
import { findChapterWithWork, findStoryRecords } from "./store";
import type { GetChapterGraphInput, GetChapterGraphResult } from "./types";

export async function getChapterGraph(input: GetChapterGraphInput): Promise<GetChapterGraphResult> {
  const found = await findChapterWithWork(input.chapterId);
  if (!found || found.work.id !== input.workId) {
    return { success: false, error: { code: "novels.chapter_not_found", message: "Capítulo não encontrado." } };
  }
  const records = await findStoryRecords(found.work);
  const scenes = records.scenes.filter((scene) => scene.chapterId === found.chapter.id);
  const sceneIds = new Set(scenes.map((scene) => scene.id));
  const imageUrls = await resolveMediaUrls([
    ...scenes.flatMap((scene) => sceneMediaIds(scene.blocks)),
    ...records.cast.flatMap((member) => (member.portraitMediaId ? [member.portraitMediaId] : [])),
  ]);
  const { work } = found;

  return {
    success: true,
    data: {
      work: {
        id: work.id,
        slug: work.slug,
        title: work.title,
        defaultLocale: work.defaultLocale,
        locales: work.locales,
        variables: work.variables,
        status: work.status,
      },
      chapter: found.chapter,
      cast: records.cast,
      chapterNumber: records.chapters.findIndex((chapter) => chapter.id === found.chapter.id) + 1,
      chapterCount: records.chapters.length,
      graph: {
        startSceneId: found.chapter.startSceneId,
        scenes: scenes.map((scene) => toChapterGraphScene(scene)),
        choices: records.choices.filter((choice) => sceneIds.has(choice.sceneId)),
      },
      imageUrls,
    },
  };
}
