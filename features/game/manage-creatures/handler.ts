import { authorizeActor } from "@venore/plugin-sdk/rbac";
import { MANAGE_PERMISSION } from "../../../shared/constants";
import * as service from "./service";
import type { DeleteCreatureInput, CreatureVoidResult, ReorderCreaturesInput, SaveCreatureInput, SaveCreatureResult } from "./types";

const invalid = (message: string) => ({ success: false as const, error: { code: "novels.invalid_input", message } });
const isId = (value: unknown): value is string => typeof value === "string" && value.length > 0 && value.length <= 64;

export async function saveCreatureHandler(input: SaveCreatureInput): Promise<SaveCreatureResult> {
  if (!isId(input.workId) || (input.id != null && !isId(input.id))) return invalid("Criatura não informada.");
  if (!input.creature || typeof input.creature !== "object" || JSON.stringify(input.creature).length > 40_000) return invalid("Criatura inválida.");
  const authz = await authorizeActor(MANAGE_PERMISSION);
  if (!authz.authorized) return { success: false, error: authz.error };
  return service.saveCreature({ ...input, actorId: authz.actorId });
}

export async function deleteCreatureHandler(input: DeleteCreatureInput): Promise<CreatureVoidResult> {
  if (!isId(input.workId) || !isId(input.id)) return invalid("Criatura não informada.");
  const authz = await authorizeActor(MANAGE_PERMISSION);
  if (!authz.authorized) return { success: false, error: authz.error };
  return service.deleteCreature({ ...input, actorId: authz.actorId });
}

export async function reorderCreaturesHandler(input: ReorderCreaturesInput): Promise<CreatureVoidResult> {
  if (!isId(input.workId) || !Array.isArray(input.orderedIds) || input.orderedIds.length > 500 || !input.orderedIds.every(isId)) {
    return invalid("Ordem inválida.");
  }
  const authz = await authorizeActor(MANAGE_PERMISSION);
  if (!authz.authorized) return { success: false, error: authz.error };
  return service.reorderCreatures({ ...input, actorId: authz.actorId });
}
