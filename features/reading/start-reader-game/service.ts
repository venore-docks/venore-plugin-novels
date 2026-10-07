import { storyForEngine } from "../../../shared/build-story";
import { createContext } from "../../../shared/engine/context";
import { newGame, toSaved } from "../../../shared/engine/play";
import { newSeed } from "../../../shared/engine/rng";
import { findCarriedProgress, findStoryRecords, findWorkById, upsertReaderProgress } from "./store";
import type { StartReaderGameCommand, StartReaderGameResult } from "./types";

// Começa (ou recomeça) a partida com semente nova do servidor. Finais e conquistas descobertos em
// partidas anteriores continuam.
export async function startReaderGame(command: StartReaderGameCommand): Promise<StartReaderGameResult> {
  const work = await findWorkById(command.workId);
  if (!work || work.status !== "published") {
    return { success: false, error: { code: "novels.work_not_found", message: "Obra não encontrada." } };
  }
  const [records, carried] = await Promise.all([findStoryRecords(work), findCarriedProgress(command.userId, work.id)]);
  const ctx = createContext(storyForEngine(records));
  const result = newGame(ctx, { seed: newSeed(), start: command.start, ...carried });
  if (!result.ok) return { success: false, error: { code: "novels.cannot_start", message: result.reason } };
  const saved = toSaved(result.state);
  await upsertReaderProgress(command.userId, work.id, saved);
  return { success: true, data: saved };
}
