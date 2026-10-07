import { beginOperation, endOperation } from "@venore/plugin-sdk/observability";
import type { CreatureRecord } from "../../../contracts/game";
import { GAME_LIMITS, creatureFieldsError, sanitizeCreatureFields } from "../../../shared/game-input";
import { normalizeLocalizedText } from "../../../shared/localized-text";
import { hasBlockingIssues, validateStory } from "../../../shared/story-validation";
import * as store from "./store";
import type { DeleteCreatureInput, CreatureVoidResult, ReorderCreaturesInput, SaveCreatureInput, SaveCreatureResult, WithActor } from "./types";

function operation(useCase: string, actorId: string) {
  const handle = beginOperation({ useCase, actor: { id: actorId, type: "user" }, kind: "write" });
  return {
    fail: (code: string, message: string) => {
      const error = { code, message };
      endOperation(handle, { success: false, error });
      return { success: false as const, error };
    },
    done: () => endOperation(handle, { success: true }),
  };
}

// Obra publicada não fica quebrada por mudança no catálogo (criatura apagada usada num encontro).
async function breaksPublished(workId: string, creatures: (records: CreatureRecord[]) => CreatureRecord[]): Promise<string | null> {
  const work = await store.findWorkById(workId);
  if (!work || work.status !== "published") return null;
  const records = await store.findStoryRecords(work);
  const issues = validateStory({ ...records, creatures: creatures(records.creatures) });
  return hasBlockingIssues(issues) ? (issues.find((issue) => issue.severity === "error")?.message ?? "erro") : null;
}

export async function saveCreature(input: WithActor<SaveCreatureInput>): Promise<SaveCreatureResult> {
  const op = operation("novels.save-creature", input.actorId);
  const work = await store.findWorkById(input.workId);
  if (!work) return op.fail("novels.work_not_found", "Obra não encontrada.");
  const fields = sanitizeCreatureFields(input.creature);
  fields.name = normalizeLocalizedText(fields.name, work.locales);
  fields.description = normalizeLocalizedText(fields.description, work.locales);
  const problem = creatureFieldsError(fields, work.defaultLocale);
  if (problem) return op.fail("novels.invalid_creature", problem);
  const sameKey = await store.findCreatureIdByKey(work.id, fields.key);
  if (sameKey && sameKey !== input.id) return op.fail("novels.duplicate_creature_key", `Já existe uma criatura com a chave "${fields.key}".`);

  if (input.id) {
    const broken = await breaksPublished(work.id, (creatures) => creatures.map((creature) => (creature.id === input.id ? { ...creature, ...fields } : creature)));
    if (broken) return op.fail("novels.would_break_published", `Essa mudança deixaria a obra publicada com erro: ${broken}`);
    if (!(await store.updateCreature(work.id, input.id, fields))) return op.fail("novels.creature_not_found", "Criatura não encontrada.");
    op.done();
    return { success: true, data: { id: input.id } };
  }
  if ((await store.countCreatures(work.id)) >= GAME_LIMITS.creatures) return op.fail("novels.too_many_creatures", `No máximo ${GAME_LIMITS.creatures} criaturas por obra.`);
  const id = await store.insertCreature(work.id, fields);
  op.done();
  return { success: true, data: { id } };
}

export async function deleteCreature(input: WithActor<DeleteCreatureInput>): Promise<CreatureVoidResult> {
  const op = operation("novels.delete-creature", input.actorId);
  const broken = await breaksPublished(input.workId, (creatures) => creatures.filter((creature) => creature.id !== input.id));
  if (broken) return op.fail("novels.would_break_published", `Essa criatura ainda é usada na obra publicada: ${broken}`);
  if (!(await store.deleteCreature(input.workId, input.id))) return op.fail("novels.creature_not_found", "Criatura não encontrada.");
  op.done();
  return { success: true, data: null };
}

export async function reorderCreatures(input: WithActor<ReorderCreaturesInput>): Promise<CreatureVoidResult> {
  const op = operation("novels.reorder-creatures", input.actorId);
  await store.reorderCreatures(input.workId, [...new Set(input.orderedIds)]);
  op.done();
  return { success: true, data: null };
}
