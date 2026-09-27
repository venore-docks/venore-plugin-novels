import type { ChapterGraphScene, ChapterRecord, ChoiceRecord, SceneRecord, Story, WorkRecord } from "../contracts/types";

export function toChapterGraphScene(scene: SceneRecord): ChapterGraphScene {
  return {
    id: scene.id,
    label: scene.label,
    imageMediaId: scene.imageMediaId,
    body: scene.body,
    isEnding: scene.isEnding,
    endingTitle: scene.endingTitle,
    effects: scene.effects,
    graphX: scene.graphX,
    graphY: scene.graphY,
  };
}

// Monta o Story (formato do leitor/validador) a partir das linhas do banco + URLs de mídia já
// resolvidas. Puro: quem busca URL é o service.
export function buildStory(
  records: { work: WorkRecord; chapters: ChapterRecord[]; scenes: SceneRecord[]; choices: ChoiceRecord[] },
  mediaUrls: Record<string, string>,
): Story {
  const { work } = records;
  return {
    work: {
      id: work.id,
      slug: work.slug,
      title: work.title,
      synopsis: work.synopsis,
      defaultLocale: work.defaultLocale,
      locales: work.locales,
      coverUrl: work.coverMediaId ? (mediaUrls[work.coverMediaId] ?? null) : null,
      variables: work.variables,
    },
    chapters: records.chapters.map((chapter) => ({
      id: chapter.id,
      position: chapter.position,
      title: chapter.title,
      startSceneId: chapter.startSceneId,
    })),
    scenes: records.scenes.map((scene) => ({
      ...toChapterGraphScene(scene),
      chapterId: scene.chapterId,
      imageUrl: scene.imageMediaId ? (mediaUrls[scene.imageMediaId] ?? null) : null,
    })),
    choices: records.choices,
  };
}

export function collectMediaIds(records: { work: WorkRecord; scenes: SceneRecord[] }): string[] {
  const ids = new Set<string>();
  if (records.work.coverMediaId) ids.add(records.work.coverMediaId);
  for (const scene of records.scenes) if (scene.imageMediaId) ids.add(scene.imageMediaId);
  return [...ids];
}
