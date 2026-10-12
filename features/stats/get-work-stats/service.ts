import type { SceneRecord } from "../../../contracts/types";
import { storyForEngine } from "../../../shared/build-story";
import { createContext } from "../../../shared/engine/context";
import { fromLegacy, isSavedGame, replay } from "../../../shared/engine/play";
import type { GameState } from "../../../shared/engine/types";
import { countProgress, findProgressSample, findStoryRecords, findWorkById } from "./store";
import type { ChoiceCount, GetWorkStatsInput, GetWorkStatsResult, SceneCount } from "./types";

export const STATS_SAMPLE = 500;

// Refaz as partidas mais recentes (até STATS_SAMPLE) com o motor e conta: onde os leitores estão
// parados, que finais viram, que escolhas fazem e onde um recurso zerou ("onde morrem"). Nada
// identifica o leitor na resposta.
export async function getWorkStats(input: GetWorkStatsInput): Promise<GetWorkStatsResult> {
  const work = await findWorkById(input.workId);
  if (!work) return { success: false, error: { code: "novels.work_not_found", message: "Obra não encontrada." } };
  const [records, total, sample] = await Promise.all([findStoryRecords(work), countProgress(work.id), findProgressSample(work.id, STATS_SAMPLE)]);
  const ctx = createContext(storyForEngine(records));
  const scenes = new Map(records.scenes.map((scene) => [scene.id, scene]));
  const chapters = new Map(records.chapters.map((chapter) => [chapter.id, chapter]));
  const triggerScenes = new Set(
    ctx.system.modules.resources ? ctx.system.resources.flatMap((resource) => [resource.onZero?.sceneId]).filter((id): id is string => Boolean(id)) : [],
  );

  const endings = new Map<string, number>();
  const stops = new Map<string, number>();
  const deaths = new Map<string, number>();
  const choices = new Map<string, number>();
  let finished = 0;

  for (const raw of sample) {
    let state: GameState | null = null;
    if (isSavedGame(raw)) state = replay(ctx, raw).state;
    else if (raw && typeof raw === "object" && "sceneId" in raw) state = fromLegacy(ctx, raw);
    if (!state || !state.started) continue;
    for (const ending of state.visitedEndings) endings.set(ending, (endings.get(ending) ?? 0) + 1);
    const current = scenes.get(state.sceneId);
    if (current?.isEnding) finished += 1;
    else stops.set(state.sceneId, (stops.get(state.sceneId) ?? 0) + 1);
    for (const action of state.log) if (action.t === "choose") choices.set(action.choiceId, (choices.get(action.choiceId) ?? 0) + 1);
    if (triggerScenes.has(state.sceneId) && state.path.length >= 2) {
      const before = state.path[state.path.length - 2];
      deaths.set(before, (deaths.get(before) ?? 0) + 1);
    }
  }

  const sceneCounts = (counts: Map<string, number>, limit: number): SceneCount[] =>
    [...counts.entries()]
      .map(([sceneId, count]) => {
        const scene = scenes.get(sceneId) as SceneRecord | undefined;
        return { sceneId, label: scene?.label || "cena apagada", chapterTitle: chapters.get(scene?.chapterId ?? "")?.title ?? {}, count };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);

  const perScene = new Map<string, number>();
  for (const [choiceId, count] of choices) {
    const sceneId = ctx.choices.get(choiceId)?.sceneId;
    if (sceneId) perScene.set(sceneId, (perScene.get(sceneId) ?? 0) + count);
  }
  const choiceCounts: ChoiceCount[] = [...choices.entries()]
    .map(([choiceId, count]) => {
      const choice = ctx.choices.get(choiceId);
      const sceneTotal = choice ? (perScene.get(choice.sceneId) ?? count) : count;
      return {
        choiceId,
        label: choice?.label ?? {},
        sceneLabel: (choice && scenes.get(choice.sceneId)?.label) || "cena apagada",
        count,
        share: sceneTotal > 0 ? Math.round((count / sceneTotal) * 100) : 0,
      };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 30);

  return {
    success: true,
    data: { readers: total, sampled: sample.length, finished, endings: sceneCounts(endings, 30), stops: sceneCounts(stops, 15), deaths: sceneCounts(deaths, 15), choices: choiceCounts },
  };
}
