import { beginOperation, endOperation } from "@venore/plugin-sdk/observability";
import { normalizeSystem } from "../../../shared/engine/system";
import { hasBlockingIssues, validateStory } from "../../../shared/story-validation";
import { findStoryRecords, findWorkById, updateGameSystemRow } from "./store";
import type { UpdateGameSystemCommand, UpdateGameSystemResult } from "./types";

// Salva o sistema de jogo da obra. Rascunho pode ficar incompleto (o validador mostra o que falta);
// obra publicada não pode ficar quebrada.
export async function updateGameSystem(command: UpdateGameSystemCommand): Promise<UpdateGameSystemResult> {
  const handle = beginOperation({ useCase: "novels.update-game-system", actor: { id: command.actorId, type: "user" }, kind: "write" });
  const fail = (code: string, message: string): UpdateGameSystemResult => {
    const error = { code, message };
    endOperation(handle, { success: false, error });
    return { success: false, error };
  };

  const current = await findWorkById(command.workId);
  if (!current) return fail("novels.work_not_found", "Obra não encontrada.");
  const system = normalizeSystem(command.system);

  if (current.status === "published") {
    const issues = validateStory(await findStoryRecords({ ...current, gameSystem: system }));
    const blocking = issues.find((issue) => issue.severity === "error");
    if (hasBlockingIssues(issues)) {
      return fail("novels.would_break_published", `Essa mudança deixaria a obra publicada com erro: ${blocking?.message}`);
    }
  }

  await updateGameSystemRow(current.id, system);
  endOperation(handle, { success: true });
  return { success: true, data: { system } };
}
