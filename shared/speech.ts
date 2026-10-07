import type { CastMember, SceneRecord, WorkRecord } from "../contracts/types";
import { sceneTextIn } from "./scene-blocks";

// Leitura em voz alta (@venore/plugin-sdk/speech): um scope por obra, um item por cena e idioma.
export const workSpeechScope = (workId: string) => `novels.work:${workId}`;

const SCENE_ITEM_PREFIX = "scene:";
export const sceneSpeechItemKey = (sceneId: string) => `${SCENE_ITEM_PREFIX}${sceneId}`;

export function sceneIdFromSpeechItemKey(itemKey: string): string | null {
  return itemKey.startsWith(SCENE_ITEM_PREFIX) ? itemKey.slice(SCENE_ITEM_PREFIX.length) : null;
}

export type SpeechItem = { itemKey: string; locale: string; text: string };

// Só o texto escrito naquele idioma: cena sem tradução não ganha áudio no idioma (o leitor mostra
// o texto do idioma principal, e tocar esse áudio no lugar confundiria). O texto junta os blocos
// da cena (narração, legendas, falas com o nome de quem fala).
export function speechItemsForWork(
  work: Pick<WorkRecord, "locales">,
  scenes: Pick<SceneRecord, "id" | "blocks">[],
  cast: CastMember[] = [],
): SpeechItem[] {
  return scenes.flatMap((scene) =>
    work.locales
      .map((locale) => ({ itemKey: sceneSpeechItemKey(scene.id), locale, text: sceneTextIn(scene.blocks, locale, cast).trim() }))
      .filter((item) => item.text.length > 0),
  );
}

// sceneId -> locale -> URL do MP3 pronto.
export type SceneAudioIndex = Record<string, Record<string, string>>;

export function indexSceneAudio(audio: { itemKey: string; locale: string; url: string }[]): SceneAudioIndex {
  const index: SceneAudioIndex = {};
  for (const clip of audio) {
    const sceneId = sceneIdFromSpeechItemKey(clip.itemKey);
    if (!sceneId) continue;
    (index[sceneId] ??= {})[clip.locale] = clip.url;
  }
  return index;
}
