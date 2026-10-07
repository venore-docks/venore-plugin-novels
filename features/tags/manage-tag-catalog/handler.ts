import { authorizeActor } from "@venore/plugin-sdk/rbac";
import { TAGS_PERMISSION } from "../../../shared/constants";
import * as service from "./service";
import type {
  ArchiveInput,
  DeleteInput,
  InstallStarterPackResult,
  ReorderInput,
  SaveResult,
  SaveTagGroupInput,
  SaveTagInput,
  UpdateBadgesInput,
  VoidResult,
} from "./types";
import { validateTagGroupInput, validateTagInput } from "./validation";

// Catálogo de tags (Graphic Novels → Tags): permissão própria, separada de escrever obras.
async function authorize() {
  return authorizeActor(TAGS_PERMISSION);
}

const invalid = (message: string) => ({ success: false as const, error: { code: "novels.invalid_input", message } });
const isId = (value: unknown): value is string => typeof value === "string" && value.length > 0 && value.length <= 64;
const isIdList = (value: unknown): value is string[] => Array.isArray(value) && value.length <= 500 && value.every(isId);

export async function saveTagGroupHandler(input: SaveTagGroupInput): Promise<SaveResult> {
  const error = validateTagGroupInput(input);
  if (error) return { success: false, error };
  const authz = await authorize();
  if (!authz.authorized) return { success: false, error: authz.error };
  return service.saveTagGroup({ ...input, required: Boolean(input.required), allowCustom: Boolean(input.allowCustom), showOnCard: Boolean(input.showOnCard), actorId: authz.actorId });
}

export async function setTagGroupArchivedHandler(input: ArchiveInput): Promise<VoidResult> {
  if (!isId(input.id)) return invalid("Grupo não informado.");
  const authz = await authorize();
  if (!authz.authorized) return { success: false, error: authz.error };
  return service.setTagGroupArchived({ id: input.id, archived: Boolean(input.archived), actorId: authz.actorId });
}

export async function deleteTagGroupHandler(input: DeleteInput): Promise<VoidResult> {
  if (!isId(input.id)) return invalid("Grupo não informado.");
  const authz = await authorize();
  if (!authz.authorized) return { success: false, error: authz.error };
  return service.deleteTagGroup({ id: input.id, actorId: authz.actorId });
}

export async function reorderTagGroupsHandler(input: ReorderInput): Promise<VoidResult> {
  if (!isIdList(input.orderedIds)) return invalid("Ordem inválida.");
  const authz = await authorize();
  if (!authz.authorized) return { success: false, error: authz.error };
  return service.reorderTagGroups({ orderedIds: input.orderedIds, actorId: authz.actorId });
}

export async function saveTagHandler(input: SaveTagInput): Promise<SaveResult> {
  const error = validateTagInput(input);
  if (error) return { success: false, error };
  const authz = await authorize();
  if (!authz.authorized) return { success: false, error: authz.error };
  return service.saveTag({ ...input, description: input.description ?? {}, actorId: authz.actorId });
}

export async function setTagArchivedHandler(input: ArchiveInput): Promise<VoidResult> {
  if (!isId(input.id)) return invalid("Tag não informada.");
  const authz = await authorize();
  if (!authz.authorized) return { success: false, error: authz.error };
  return service.setTagArchived({ id: input.id, archived: Boolean(input.archived), actorId: authz.actorId });
}

export async function deleteTagHandler(input: DeleteInput): Promise<VoidResult> {
  if (!isId(input.id)) return invalid("Tag não informada.");
  const authz = await authorize();
  if (!authz.authorized) return { success: false, error: authz.error };
  return service.deleteTag({ id: input.id, actorId: authz.actorId });
}

export async function promoteTagHandler(input: DeleteInput): Promise<VoidResult> {
  if (!isId(input.id)) return invalid("Tag não informada.");
  const authz = await authorize();
  if (!authz.authorized) return { success: false, error: authz.error };
  return service.promoteTag({ id: input.id, actorId: authz.actorId });
}

export async function reorderTagsHandler(input: ReorderInput): Promise<VoidResult> {
  if (!isId(input.groupId) || !isIdList(input.orderedIds)) return invalid("Ordem inválida.");
  const authz = await authorize();
  if (!authz.authorized) return { success: false, error: authz.error };
  return service.reorderTags({ groupId: input.groupId, orderedIds: input.orderedIds, actorId: authz.actorId });
}

export async function updateBadgesHandler(input: UpdateBadgesInput): Promise<VoidResult> {
  if (!input.badges || typeof input.badges !== "object") return invalid("Textos dos selos inválidos.");
  const authz = await authorize();
  if (!authz.authorized) return { success: false, error: authz.error };
  return service.updateBadges({ badges: input.badges, actorId: authz.actorId });
}

export async function installTagStarterPackHandler(): Promise<InstallStarterPackResult> {
  const authz = await authorize();
  if (!authz.authorized) return { success: false, error: authz.error };
  return service.installTagStarterPack({ actorId: authz.actorId });
}
