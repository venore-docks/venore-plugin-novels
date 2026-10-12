import { beginOperation, endOperation } from "@venore/plugin-sdk/observability";
import type { ItemRecord } from "../../../contracts/game";
import { GAME_LIMITS, itemFieldsError, sanitizeItemFields } from "../../../shared/game-input";
import { normalizeLocalizedText } from "../../../shared/localized-text";
import { hasBlockingIssues, validateStory } from "../../../shared/story-validation";
import * as store from "./store";
import type { DeleteItemInput, ItemVoidResult, ReorderItemsInput, SaveItemInput, SaveItemResult, WithActor } from "./types";

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

// Obra publicada não fica quebrada por mudança no catálogo (item apagado usado numa cena).
async function breaksPublished(workId: string, items: (records: ItemRecord[]) => ItemRecord[]): Promise<string | null> {
  const work = await store.findWorkById(workId);
  if (!work || work.status !== "published") return null;
  const records = await store.findStoryRecords(work);
  const issues = validateStory({ ...records, items: items(records.items) });
  return hasBlockingIssues(issues) ? (issues.find((issue) => issue.severity === "error")?.message ?? "erro") : null;
}

export async function saveItem(input: WithActor<SaveItemInput>): Promise<SaveItemResult> {
  const op = operation("novels.save-item", input.actorId);
  const work = await store.findWorkById(input.workId);
  if (!work) return op.fail("novels.work_not_found", "Obra não encontrada.");
  const fields = sanitizeItemFields(input.item);
  fields.name = normalizeLocalizedText(fields.name, work.locales);
  fields.description = normalizeLocalizedText(fields.description, work.locales);
  const problem = itemFieldsError(fields, work.defaultLocale);
  if (problem) return op.fail("novels.invalid_item", problem);
  const sameKey = await store.findItemIdByKey(work.id, fields.key);
  if (sameKey && sameKey !== input.id) return op.fail("novels.duplicate_item_key", `Já existe um item com a chave "${fields.key}".`);

  if (input.id) {
    const broken = await breaksPublished(work.id, (items) => items.map((item) => (item.id === input.id ? { ...item, ...fields } : item)));
    if (broken) return op.fail("novels.would_break_published", `Essa mudança deixaria a obra publicada com erro: ${broken}`);
    if (!(await store.updateItem(work.id, input.id, fields))) return op.fail("novels.item_not_found", "Item não encontrado.");
    op.done();
    return { success: true, data: { id: input.id } };
  }
  if ((await store.countItems(work.id)) >= GAME_LIMITS.items) return op.fail("novels.too_many_items", `No máximo ${GAME_LIMITS.items} itens por obra.`);
  const id = await store.insertItem(work.id, fields);
  op.done();
  return { success: true, data: { id } };
}

export async function deleteItem(input: WithActor<DeleteItemInput>): Promise<ItemVoidResult> {
  const op = operation("novels.delete-item", input.actorId);
  const broken = await breaksPublished(input.workId, (items) => items.filter((item) => item.id !== input.id));
  if (broken) return op.fail("novels.would_break_published", `Esse item ainda é usado na obra publicada: ${broken}`);
  if (!(await store.deleteItem(input.workId, input.id))) return op.fail("novels.item_not_found", "Item não encontrado.");
  op.done();
  return { success: true, data: null };
}

export async function reorderItems(input: WithActor<ReorderItemsInput>): Promise<ItemVoidResult> {
  const op = operation("novels.reorder-items", input.actorId);
  await store.reorderItems(input.workId, [...new Set(input.orderedIds)]);
  op.done();
  return { success: true, data: null };
}
