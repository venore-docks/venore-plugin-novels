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
import type { CreatureRecord, ItemRecord } from "../contracts/game";
import { withoutWork } from "./game-records";
import { sceneMediaIds } from "./scene-blocks";

export function toChapterGraphScene(scene: SceneRecord): ChapterGraphScene {
  return {
    id: scene.id,
    label: scene.label,
    blocks: scene.blocks,
    isEnding: scene.isEnding,
    endingTitle: scene.endingTitle,
    effects: scene.effects,
    mechanics: scene.mechanics,
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
  items: ItemRecord[];
  creatures: CreatureRecord[];
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
    system: work.gameSystem,
    items: records.items.map(withoutWork),
    creatures: records.creatures.map(withoutWork),
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

export function collectMediaIds(records: Pick<StoryRecords, "work" | "scenes" | "cast"> & Partial<Pick<StoryRecords, "items" | "creatures">>): string[] {
  const ids = new Set<string>();
  for (const item of records.items ?? []) if (item.imageMediaId) ids.add(item.imageMediaId);
  for (const creature of records.creatures ?? []) if (creature.imageMediaId) ids.add(creature.imageMediaId);
  for (const vocation of records.work.gameSystem?.character.vocations ?? []) if (vocation.imageMediaId) ids.add(vocation.imageMediaId);
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

// Story só para o motor (conferência do progresso no servidor, estatísticas, simulador): sem URLs
// de mídia nem tags, que o motor não lê.
export function storyForEngine(records: StoryRecords): Story {
  return buildStory(records, { media: {}, tags: [], badges: { interactive: {}, textOnly: {}, aiAudio: {} } });
}
