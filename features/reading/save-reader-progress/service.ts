import { findWorkById, upsertReaderProgress } from "./store";
import type { SaveReaderProgressCommand, SaveReaderProgressResult } from "./types";

// Sem beginOperation: é chamado a cada escolha do leitor, e o log operacional de escrita
// geraria uma linha por clique sem valor de auditoria (AGENTS.md, "Log síncrono por chamada").
export async function saveReaderProgress(command: SaveReaderProgressCommand): Promise<SaveReaderProgressResult> {
  const work = await findWorkById(command.workId);
  if (!work || work.status !== "published") {
    return { success: false, error: { code: "novels.work_not_found", message: "Obra não encontrada." } };
  }
  const updatedAt = await upsertReaderProgress(command.userId, work.id, command.state);
  return { success: true, data: { updatedAt } };
}
