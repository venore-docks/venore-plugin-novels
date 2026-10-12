import type { VariableValue } from "../../../contracts/types";
import { storyForEngine } from "../../../shared/build-story";
import { createContext } from "../../../shared/engine/context";
import { fromLegacy, isSavedGame, replay } from "../../../shared/engine/play";
import { findProgressState, findStoryRecords, findWorkById } from "./store";
import type { GetSeriesCarryResult } from "./types";

// O estado final da partida na obra anterior da série inicia esta: só as chaves que o autor
// marcou para passar. A obra anterior refaz a partida com as regras dela.
export async function getSeriesCarry(input: { workId: string; userId: string }): Promise<GetSeriesCarryResult> {
  const work = await findWorkById(input.workId);
  const series = work?.gameSystem.series;
  if (!work || !series?.previousWorkId || series.carry.length === 0) return { success: true, data: {} };
  const previous = await findWorkById(series.previousWorkId);
  if (!previous || previous.status !== "published") return { success: true, data: {} };
  const progress = await findProgressState(input.userId, previous.id);
  if (!progress) return { success: true, data: {} };
  const ctx = createContext(storyForEngine(await findStoryRecords(previous)));
  const state = isSavedGame(progress) ? replay(ctx, progress).state : fromLegacy(ctx, progress);
  if (!state) return { success: true, data: {} };
  const carry: Record<string, VariableValue> = {};
  for (const key of series.carry) {
    const value = state.vars[key];
    if (typeof value === "number" || typeof value === "boolean") carry[key] = value;
  }
  return { success: true, data: carry };
}
