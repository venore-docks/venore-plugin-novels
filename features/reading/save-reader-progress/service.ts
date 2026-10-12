import { storyForEngine } from "../../../shared/build-story";
import { createContext } from "../../../shared/engine/context";
import { replay, toSaved } from "../../../shared/engine/play";
import { extendsLog, mergeStats } from "../../../shared/reader-stats";
import { findStoredProgress, findStoryRecords, findWorkById, saveProgressAndStats } from "./store";
import type { SaveReaderProgressCommand, SaveReaderProgressResult } from "./types";

// Sem beginOperation: é chamado a cada escolha do leitor, e o log operacional de escrita
// geraria uma linha por clique sem valor de auditoria (AGENTS.md, "Log síncrono por chamada").
//
// Só quem tem conta salva, e só para a frente (0.14.0): o registro novo precisa continuar o salvo,
// com a mesma semente (a jornada começa em start-reader-game, com semente do servidor). Para
// seguir outro caminho, o leitor começa uma nova jornada. O servidor refaz a partida pelas regras
// da obra (nada de ficha forjada) e soma o que a jornada mostrou ao desempenho do leitor.
export async function saveReaderProgress(command: SaveReaderProgressCommand): Promise<SaveReaderProgressResult> {
  const work = await findWorkById(command.workId);
  if (!work || work.status !== "published") {
    return { success: false, error: { code: "novels.work_not_found", message: "Obra não encontrada." } };
  }
  if (command.progress.kind === "legacy") {
    return { success: false, error: { code: "novels.outdated_progress", message: "Recarregue a página para continuar." } };
  }

  const saved = command.progress.saved;
  const stored = await findStoredProgress(command.userId, work.id);
  if (!stored || stored.seed !== saved.seed) {
    return {
      success: false,
      error: { code: "novels.seed_mismatch", message: "Essa jornada não é a que está salva na sua conta. Recarregue a página." },
    };
  }
  if (!extendsLog(stored.log, saved.log)) {
    return { success: false, error: { code: "novels.no_going_back", message: "Não dá para voltar na história. Para outro caminho, comece uma nova jornada." } };
  }

  const ctx = createContext(storyForEngine(await findStoryRecords(work)));
  const { state, truncated } = replay(ctx, saved);
  const canonical = toSaved(state);
  const finished = Boolean(ctx.scenes.get(state.sceneId)?.isEnding);
  const updatedAt = await saveProgressAndStats(command.userId, work.id, canonical, (current) =>
    mergeStats(current, {
      seed: saved.seed,
      scenes: state.path,
      choices: state.log.flatMap((action) => (action.t === "choose" ? [action.choiceId] : [])),
      endings: state.visitedEndings,
      achievements: state.achievements,
      finished,
    }),
  );
  return { success: true, data: { updatedAt, truncated } };
}
