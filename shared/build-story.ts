import type {
  CastMemberRecord,
  CatalogBadges,
  ChapterGraphScene,
  ChapterRecord,
  ChoiceRecord,
  SceneRecord,
  Story,
  WorkRecord,
  WorkTagGroupView,
} from "../contracts/types";
import { sceneMediaIds } from "./scene-blocks";

export function toChapterGraphScene(scene: SceneRecord): ChapterGraphScene {
  return {
    id: scene.id,
    label: scene.label,
    blocks: scene.blocks,
    isEnding: scene.isEnding,
    endingTitle: scene.endingTitle,
    effects: scene.effects,
    graphX: scene.graphX,
    graphY: scene.graphY,
  };
}

export type StoryRecords = {
  work: WorkRecord;
  chapters: ChapterRecord[];
  scenes: SceneRecord[];
  choices: ChoiceRecord[];
  cast: CastMemberRecord[];
};

// Monta o Story (formato do leitor/validador) a partir das linhas do banco + URLs de mídia já
// resolvidas. Puro: quem busca URL e tags é o service.
export function buildStory(
  records: StoryRecords,
  extras: { media: Record<string, string>; tags: WorkTagGroupView[]; badges: CatalogBadges; audio?: Story["audio"] },
): Story {
  const { work } = records;
  return {
    work: {
      id: work.id,
      slug: work.slug,
      title: work.title,
      subtitle: work.subtitle,
      synopsis: work.synopsis,
      defaultLocale: work.defaultLocale,
      locales: work.locales,
      coverUrl: work.coverMediaId ? (extras.media[work.coverMediaId] ?? null) : null,
      coverFocus: work.coverFocus,
      variables: work.variables,
      tags: extras.tags,
    },
    badges: extras.badges,
    chapters: records.chapters.map((chapter) => ({
      id: chapter.id,
      position: chapter.position,
      title: chapter.title,
      startSceneId: chapter.startSceneId,
    })),
    scenes: records.scenes.map((scene) => ({ ...toChapterGraphScene(scene), chapterId: scene.chapterId })),
    choices: records.choices,
    cast: records.cast.map((member) => ({
      id: member.id,
      name: member.name,
      color: member.color,
      portraitMediaId: member.portraitMediaId,
      position: member.position,
    })),
    media: extras.media,
    audio: extras.audio ?? {},
  };
}

export function collectMediaIds(records: Pick<StoryRecords, "work" | "scenes" | "cast">): string[] {
  const ids = new Set<string>();
  if (records.work.coverMediaId) ids.add(records.work.coverMediaId);
  for (const scene of records.scenes) for (const id of sceneMediaIds(scene.blocks)) ids.add(id);
  for (const member of records.cast) if (member.portraitMediaId) ids.add(member.portraitMediaId);
  return [...ids];
}

// Alguma cena com mais de uma escolha: a obra é "interativa" (selo calculado, nunca escolhido).
export function isInteractive(choices: Pick<ChoiceRecord, "sceneId">[]): boolean {
  const perScene = new Map<string, number>();
  for (const choice of choices) {
    const count = (perScene.get(choice.sceneId) ?? 0) + 1;
    if (count > 1) return true;
    perScene.set(choice.sceneId, count);
  }
  return false;
}
