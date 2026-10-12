import { beginOperation, endOperation } from "@venore/plugin-sdk/observability";
import { planWorkImport } from "../../../shared/work-package";
import { findExamplePackage, findTagIdsBySlugs, findTakenSlugs, insertImportedWork } from "./store";
import type { ImportWorkCommand, ImportWorkResult } from "./types";

// O pacote é lido e conferido inteiro antes de gravar (shared/work-package.ts); a gravação é uma
// transação só. Endereço já usado ganha sufixo (-2, -3...): importar o mesmo exemplo duas vezes
// cria duas obras. Tags do pacote que não existem no catálogo da instalação são ignoradas.
export async function importWork(command: ImportWorkCommand): Promise<ImportWorkResult> {
  const handle = beginOperation({
    useCase: "novels.import-work",
    actor: { id: command.actorId, type: "user" },
    kind: "write",
  });
  const fail = (code: string, message: string): ImportWorkResult => {
    const error = { code, message };
    endOperation(handle, { success: false, error });
    return { success: false, error };
  };

  const raw = command.source.kind === "file" ? command.source.content : await findExamplePackage(command.source.key);
  if (raw === null) return fail("novels.example_not_found", "História de exemplo não encontrada.");

  const plan = planWorkImport(raw, () => crypto.randomUUID());
  if (!plan.ok) return fail("novels.invalid_package", plan.errors.join("\n"));

  const imported = plan.value;
  const taken = new Set(await findTakenSlugs(imported.work.slug));
  let slug = imported.work.slug;
  for (let suffix = 2; taken.has(slug); suffix += 1) slug = `${imported.work.slug.slice(0, 74)}-${suffix}`;

  const tagIds = await findTagIdsBySlugs(imported.work.tags);
  const workId = await insertImportedWork({ ...imported, work: { ...imported.work, slug } }, { authorUserId: command.actorId, tagIds });

  const errors = plan.issues.filter((issue) => issue.severity === "error");
  const summary = {
    workId,
    slug,
    title: imported.work.title,
    chapters: imported.chapters.length,
    scenes: imported.chapters.reduce((sum, chapter) => sum + chapter.graph.scenes.length, 0),
    errors: errors.length,
    warnings: plan.issues.length - errors.length,
    firstIssues: [...errors, ...plan.issues.filter((issue) => issue.severity === "warning")].slice(0, 5).map((issue) => issue.message),
  };
  endOperation(handle, { success: true, detail: { workId, scenes: summary.scenes, source: command.source.kind } });
  return { success: true, data: summary };
}
