import { beginOperation, endOperation } from "@venore/plugin-sdk/observability";
import { findWorkById, setWorkStatus } from "./store";
import type { UnpublishWorkCommand, UnpublishWorkResult } from "./types";

// Volta pra rascunho mantendo publishedAt (data da primeira publicação) e o progresso dos
// leitores, que reencontram a obra quando ela for republicada.
export async function unpublishWork(command: UnpublishWorkCommand): Promise<UnpublishWorkResult> {
  const handle = beginOperation({
    useCase: "novels.unpublish-work",
    actor: { id: command.actorId, type: "user" },
    kind: "write",
  });
  const work = await findWorkById(command.workId);
  if (!work) {
    const error = { code: "novels.work_not_found", message: "Obra não encontrada." };
    endOperation(handle, { success: false, error });
    return { success: false, error };
  }
  // O áudio fica: republicar sem mudança no texto não gera de novo (sync-work-speech).
  const updated = await setWorkStatus(work.id, "draft", work.publishedAt);
  endOperation(handle, { success: true });
  return { success: true, data: updated };
}
