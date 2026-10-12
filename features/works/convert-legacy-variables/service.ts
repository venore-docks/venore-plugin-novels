import { beginOperation, endOperation } from "@venore/plugin-sdk/observability";
import type { Effect } from "../../../contracts/game";
import { planLegacyConversion, resolveItemRefs } from "../../../shared/legacy-conversion";
import { hasBlockingIssues, validateStory } from "../../../shared/story-validation";
import { applyConversion, findStoryRecords, findWorkById } from "./store";
import type { ConvertLegacyVariablesCommand, ConvertLegacyVariablesResult } from "./types";

// Variáveis antigas -> recursos e itens do catálogo, com os efeitos e condições reescritos.
export async function convertLegacyVariables(command: ConvertLegacyVariablesCommand): Promise<ConvertLegacyVariablesResult> {
  const handle = beginOperation({ useCase: "novels.convert-legacy-variables", actor: { id: command.actorId, type: "user" }, kind: "write" });
  const fail = (code: string, message: string): ConvertLegacyVariablesResult => {
    const error = { code, message };
    endOperation(handle, { success: false, error });
    return { success: false, error };
  };
  const work = await findWorkById(command.workId);
  if (!work) return fail("novels.work_not_found", "Obra não encontrada.");
  const records = await findStoryRecords(work);
  const plan = planLegacyConversion({
    variables: work.variables,
    system: work.gameSystem,
    locale: work.defaultLocale,
    existingItemKeys: records.items.map((item) => item.key),
    scenes: records.scenes,
    choices: records.choices,
  });
  if (plan.summary.resources.length + plan.summary.items.length === 0 && !plan.summary.capacity) {
    return fail("novels.nothing_to_convert", "Nenhuma variável para converter (barra com máximo, item de inventário ou capacidade).");
  }

  const ids = new Map([...records.items.map((item) => [item.key, item.id] as const), ...plan.items.map((item) => [item.key, crypto.randomUUID()] as const)]);
  const scenes = new Map(plan.scenes.map((scene) => [scene.id, resolveItemRefs(scene.effects, ids)]));
  // Itens que o leitor já tinha no começo: efeito "dar" na cena inicial do primeiro capítulo.
  const firstChapter = [...records.chapters].sort((a, b) => a.position - b.position).find((chapter) => chapter.startSceneId);
  if (firstChapter?.startSceneId && plan.startingItems.length > 0) {
    const current = scenes.get(firstChapter.startSceneId) ?? records.scenes.find((scene) => scene.id === firstChapter.startSceneId)?.effects ?? [];
    const gifts: Effect[] = plan.startingItems.map((entry) => ({ kind: "item", operation: "give", itemId: ids.get(entry.key)!, quantity: String(entry.quantity) }));
    scenes.set(firstChapter.startSceneId, [...gifts, ...current]);
  }
  const choices = plan.choices.map((choice) => resolveItemRefs(choice, ids));
  const newItems = plan.items.map((item, index) => ({ id: ids.get(item.key)!, fields: { ...item, position: records.items.length + index } }));

  if (work.status === "published") {
    const next = {
      ...records,
      work: { ...work, variables: plan.variables, gameSystem: plan.system },
      items: [...records.items, ...newItems.map((entry) => ({ ...entry.fields, id: entry.id, workId: work.id }))],
      scenes: records.scenes.map((scene) => (scenes.has(scene.id) ? { ...scene, effects: scenes.get(scene.id)! } : scene)),
      choices: records.choices.map((choice) => {
        const changed = choices.find((entry) => entry.id === choice.id);
        return changed ? { ...choice, conditions: changed.conditions, effects: changed.effects } : choice;
      }),
    };
    const issues = validateStory(next);
    if (hasBlockingIssues(issues)) return fail("novels.would_break_published", `A conversão deixaria a obra publicada com erro: ${issues.find((issue) => issue.severity === "error")?.message}`);
  }

  await applyConversion(work.id, { variables: plan.variables, system: plan.system, items: newItems, scenes, choices });
  endOperation(handle, { success: true });
  return { success: true, data: plan.summary };
}
