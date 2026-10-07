import { storyForEngine } from "../../../shared/build-story";
import { createContext } from "../../../shared/engine/context";
import { isSavedGame, replay, toSaved } from "../../../shared/engine/play";
import { findProgressSeed, findStoryRecords, findWorkById, upsertReaderProgress } from "./store";
import type { SaveReaderProgressCommand, SaveReaderProgressResult } from "./types";

// Sem beginOperation: é chamado a cada escolha do leitor, e o log operacional de escrita
// geraria uma linha por clique sem valor de auditoria (AGENTS.md, "Log síncrono por chamada").
//
// O progresso é o registro de ações a partir de uma semente: o servidor refaz a partida com o
// mesmo motor do leitor e guarda só o que vale pelas regras da obra (nada de ficha forjada).
// A semente de quem tem conta vem do servidor (start-reader-game); trocar de semente no meio da
// partida é recusado, senão daria para escolher o resultado dos dados.
export async function saveReaderProgress(command: SaveReaderProgressCommand): Promise<SaveReaderProgressResult> {
  const work = await findWorkById(command.workId);
  if (!work || work.status !== "published") {
    return { success: false, error: { code: "novels.work_not_found", message: "Obra não encontrada." } };
  }
  if (command.progress.kind === "legacy") {
    const updatedAt = await upsertReaderProgress(command.userId, work.id, command.progress.state);
    return { success: true, data: { updatedAt, truncated: false } };
  }

  const saved = command.progress.saved;
  const storedSeed = await findProgressSeed(command.userId, work.id);
  if (storedSeed && storedSeed !== saved.seed) {
    return {
      success: false,
      error: { code: "novels.seed_mismatch", message: "Essa partida não é a que está salva na sua conta. Recarregue a página." },
    };
  }
  const ctx = createContext(storyForEngine(await findStoryRecords(work)));
  const { state, truncated } = replay(ctx, saved);
  const canonical = toSaved(state);
  if (!isSavedGame(canonical) || canonical.log.length === 0) {
    return { success: false, error: { code: "novels.invalid_progress", message: "Progresso inválido." } };
  }
  const updatedAt = await upsertReaderProgress(command.userId, work.id, canonical);
  return { success: true, data: { updatedAt, truncated } };
}
