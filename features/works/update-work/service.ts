import { beginOperation, endOperation } from "@venore/plugin-sdk/observability";
import { normalizeLocalizedText } from "../../../shared/localized-text";
import { hasBlockingIssues, validateStory } from "../../../shared/story-validation";
import { findStoryRecords, findWorkById, findWorkBySlug, updateWorkRow } from "./store";
import type { UpdateWorkCommand, UpdateWorkResult } from "./types";

export async function updateWork(command: UpdateWorkCommand): Promise<UpdateWorkResult> {
  const handle = beginOperation({
    useCase: "novels.update-work",
    actor: { id: command.actorId, type: "user" },
    kind: "write",
  });
  const fail = (code: string, message: string): UpdateWorkResult => {
    const error = { code, message };
    endOperation(handle, { success: false, error });
    return { success: false, error };
  };

  const current = await findWorkById(command.workId);
  if (!current) return fail("novels.work_not_found", "Obra não encontrada.");

  const sameSlug = await findWorkBySlug(command.slug);
  if (sameSlug && sameSlug.id !== current.id) return fail("novels.slug_taken", "Já existe uma obra com esse endereço.");

  const next = {
    slug: command.slug,
    title: normalizeLocalizedText(command.title, command.locales),
    synopsis: normalizeLocalizedText(command.synopsis, command.locales),
    defaultLocale: command.defaultLocale,
    locales: command.locales,
    coverMediaId: command.coverMediaId || null,
    variables: command.variables.map((variable) => ({ ...variable, label: variable.label.trim() || variable.key })),
  };

  // Obra publicada não pode ficar quebrada por uma edição de variável/idioma: se a mudança
  // gera erro no grafo (ex: apagou uma variável usada numa condição), recusa antes de gravar.
  if (current.status === "published") {
    const records = await findStoryRecords({ ...current, ...next });
    const issues = validateStory(records);
    if (hasBlockingIssues(issues)) {
      return fail(
        "novels.would_break_published",
        `Essa mudança deixaria a obra publicada com erro: ${issues.find((issue) => issue.severity === "error")?.message}`,
      );
    }
  }

  const work = await updateWorkRow(current.id, next);
  endOperation(handle, { success: true });
  return { success: true, data: work };
}
