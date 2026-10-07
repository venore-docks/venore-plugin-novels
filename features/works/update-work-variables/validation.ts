import { validateVariableDefinitions } from "../../../shared/story-validation";
import type { UpdateWorkVariablesInput } from "./types";

export const MAX_VARIABLES = 50;

export function validateUpdateWorkVariablesInput(input: UpdateWorkVariablesInput): { code: string; message: string } | null {
  if (!input.workId) return { code: "novels.invalid_work", message: "Obra não informada." };
  if (!Array.isArray(input.variables)) return { code: "novels.invalid_variables", message: "Variáveis inválidas." };
  if (input.variables.length > MAX_VARIABLES) {
    return { code: "novels.too_many_variables", message: `No máximo ${MAX_VARIABLES} variáveis por obra.` };
  }
  const issue = validateVariableDefinitions(input.variables)[0];
  if (issue) return { code: `novels.${issue.code}`, message: issue.message };
  return null;
}
