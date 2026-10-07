import { beginOperation, endOperation } from "@venore/plugin-sdk/observability";
import { hasBlockingIssues, validateStory } from "../../../shared/story-validation";
import { sanitizeVariable } from "../../../shared/variables";
import { findStoryRecords, findWorkById, updateWorkVariablesRow } from "./store";
import type { UpdateWorkVariablesCommand, UpdateWorkVariablesResult } from "./types";

export async function updateWorkVariables(command: UpdateWorkVariablesCommand): Promise<UpdateWorkVariablesResult> {
  const handle = beginOperation({ useCase: "novels.update-work-variables", actor: { id: command.actorId, type: "user" }, kind: "write" });
  const fail = (code: string, message: string): UpdateWorkVariablesResult => {
    const error = { code, message };
    endOperation(handle, { success: false, error });
    return { success: false, error };
  };

  const current = await findWorkById(command.workId);
  if (!current) return fail("novels.work_not_found", "Obra não encontrada.");
  const variables = command.variables.map(sanitizeVariable);

  // Obra publicada não pode ficar quebrada: apagar uma variável usada numa condição é recusado.
  if (current.status === "published") {
    const issues = validateStory(await findStoryRecords({ ...current, variables }));
    if (hasBlockingIssues(issues)) {
      return fail(
        "novels.would_break_published",
        `Essa mudança deixaria a obra publicada com erro: ${issues.find((issue) => issue.severity === "error")?.message}`,
      );
    }
  }

  const work = await updateWorkVariablesRow(current.id, variables);
  endOperation(handle, { success: true });
  return { success: true, data: work };
}
