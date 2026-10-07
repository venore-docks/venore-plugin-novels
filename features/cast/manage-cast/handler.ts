import { authorizeActor } from "@venore/plugin-sdk/rbac";
import { MANAGE_PERMISSION } from "../../../shared/constants";
import * as service from "./service";
import type {
  CastVoidResult,
  DeleteCastMemberInput,
  ReorderCastInput,
  SaveCastMemberInput,
  SaveCastMemberResult,
} from "./types";
import { validateCastMemberInput } from "./validation";

const invalid = (message: string) => ({ success: false as const, error: { code: "novels.invalid_input", message } });
const isId = (value: unknown): value is string => typeof value === "string" && value.length > 0 && value.length <= 64;

export async function saveCastMemberHandler(input: SaveCastMemberInput): Promise<SaveCastMemberResult> {
  const error = validateCastMemberInput(input);
  if (error) return { success: false, error };
  const authz = await authorizeActor(MANAGE_PERMISSION);
  if (!authz.authorized) return { success: false, error: authz.error };
  return service.saveCastMember({ ...input, actorId: authz.actorId });
}

export async function deleteCastMemberHandler(input: DeleteCastMemberInput): Promise<CastVoidResult> {
  if (!isId(input.workId) || !isId(input.id)) return invalid("Personagem não informado.");
  const authz = await authorizeActor(MANAGE_PERMISSION);
  if (!authz.authorized) return { success: false, error: authz.error };
  return service.deleteCastMember({ ...input, actorId: authz.actorId });
}

export async function reorderCastHandler(input: ReorderCastInput): Promise<CastVoidResult> {
  if (!isId(input.workId) || !Array.isArray(input.orderedIds) || !input.orderedIds.every(isId)) return invalid("Ordem inválida.");
  const authz = await authorizeActor(MANAGE_PERMISSION);
  if (!authz.authorized) return { success: false, error: authz.error };
  return service.reorderCast({ ...input, actorId: authz.actorId });
}
