import { beginOperation, endOperation } from "@venore/plugin-sdk/observability";
import { hasBlockingIssues, validateStory } from "../../../shared/story-validation";
import { findStoryRecords, findWorkById, setWorkStatus } from "./store";
import type { PublishWorkCommand, PublishWorkResult } from "./types";

// Fase 1: quem tem novels.works.manage publica direto. A aprovação por admin das obras
// de autores (status "in_review") entra na Fase 2, reaproveitando este mesmo validador.
export async function publishWork(command: PublishWorkCommand): Promise<PublishWorkResult> {
  const handle = beginOperation({
    useCase: "novels.publish-work",
    actor: { id: command.actorId, type: "user" },
    kind: "write",
  });
  const fail = (code: string, message: string): PublishWorkResult => {
    const error = { code, message };
    endOperation(handle, { success: false, error });
    return { success: false, error };
  };

  const work = await findWorkById(command.workId);
  if (!work) return fail("novels.work_not_found", "Obra não encontrada.");

  const issues = validateStory(await findStoryRecords(work));
  if (hasBlockingIssues(issues)) {
    const errors = issues.filter((issue) => issue.severity === "error");
    return fail(
      "novels.not_publishable",
      `A obra tem ${errors.length} ${errors.length === 1 ? "problema" : "problemas"} a corrigir antes de publicar: ${errors[0].message}`,
    );
  }

  const published = await setWorkStatus(work.id, "published", work.publishedAt ?? new Date());
  endOperation(handle, { success: true });
  return { success: true, data: published };
}
