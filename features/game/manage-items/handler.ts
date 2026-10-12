import { authorizeActor } from "@venore/plugin-sdk/rbac";
import { MANAGE_PERMISSION } from "../../../shared/constants";
import * as service from "./service";
import type { DeleteItemInput, ItemVoidResult, ReorderItemsInput, SaveItemInput, SaveItemResult } from "./types";

const invalid = (message: string) => ({ success: false as const, error: { code: "novels.invalid_input", message } });
const isId = (value: unknown): value is string => typeof value === "string" && value.length > 0 && value.length <= 64;

export async function saveItemHandler(input: SaveItemInput): Promise<SaveItemResult> {
  if (!isId(input.workId) || (input.id != null && !isId(input.id))) return invalid("Item não informado.");
  if (!input.item || typeof input.item !== "object" || JSON.stringify(input.item).length > 40_000) return invalid("Item inválido.");
  const authz = await authorizeActor(MANAGE_PERMISSION);
  if (!authz.authorized) return { success: false, error: authz.error };
  return service.saveItem({ ...input, actorId: authz.actorId });
}

export async function deleteItemHandler(input: DeleteItemInput): Promise<ItemVoidResult> {
  if (!isId(input.workId) || !isId(input.id)) return invalid("Item não informado.");
  const authz = await authorizeActor(MANAGE_PERMISSION);
  if (!authz.authorized) return { success: false, error: authz.error };
  return service.deleteItem({ ...input, actorId: authz.actorId });
}

export async function reorderItemsHandler(input: ReorderItemsInput): Promise<ItemVoidResult> {
  if (!isId(input.workId) || !Array.isArray(input.orderedIds) || input.orderedIds.length > 500 || !input.orderedIds.every(isId)) {
    return invalid("Ordem inválida.");
  }
  const authz = await authorizeActor(MANAGE_PERMISSION);
  if (!authz.authorized) return { success: false, error: authz.error };
  return service.reorderItems({ ...input, actorId: authz.actorId });
}
