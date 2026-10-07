import { beginOperation, endOperation } from "@venore/plugin-sdk/observability";
import { normalizeLocalizedText } from "../../../shared/localized-text";
import { SUPPORTED_LOCALES } from "../../../shared/locales";
import { cleanTagName, normalizeBadges } from "../../../shared/tag-catalog";
import { DEFAULT_BADGES, TAG_STARTER_PACK } from "../../../seeds/tag-starter-pack";
import type { LocalizedText } from "../../../contracts/types";
import * as store from "./store";
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
  WithActor,
} from "./types";

type Failure = { success: false; error: { code: string; message: string } };

// Cada escrita do catálogo vira uma operação observável; erro de negócio volta como
// OperationResult, nunca exception.
async function run<T>(useCase: string, actorId: string, body: (fail: (code: string, message: string) => Failure) => Promise<T | Failure>) {
  const handle = beginOperation({ useCase, actor: { id: actorId, type: "user" }, kind: "write" });
  const fail = (code: string, message: string): Failure => ({ success: false, error: { code, message } });
  const result = await body(fail);
  const failed = typeof result === "object" && result !== null && "success" in result && result.success === false;
  endOperation(handle, failed ? { success: false, error: (result as Failure).error } : { success: true });
  return result;
}

const LOCALES = SUPPORTED_LOCALES.map((locale) => locale.code);
const names = (text: LocalizedText) => {
  const normalized = normalizeLocalizedText(text ?? {}, LOCALES);
  return Object.fromEntries(Object.entries(normalized).map(([locale, value]) => [locale, cleanTagName(value)]));
};

export async function saveTagGroup(input: WithActor<SaveTagGroupInput>): Promise<SaveResult> {
  return run("novels.save-tag-group", input.actorId, async (fail) => {
    const sameKey = await store.findGroupByKey(input.key);
    if (sameKey && sameKey.id !== input.id) return fail("novels.tag_group_key_taken", "Já existe um grupo com essa chave.");
    const values = { ...input, name: names(input.name) };
    if (input.id) {
      if (!(await store.updateGroup(input.id, values))) return fail("novels.tag_group_not_found", "Grupo não encontrado.");
      return { success: true as const, data: { id: input.id } };
    }
    return { success: true as const, data: { id: await store.insertGroup(values) } };
  });
}

export async function setTagGroupArchived(input: WithActor<ArchiveInput>): Promise<VoidResult> {
  return run("novels.archive-tag-group", input.actorId, async (fail) => {
    if (!(await store.setGroupArchived(input.id, input.archived))) return fail("novels.tag_group_not_found", "Grupo não encontrado.");
    return { success: true as const, data: null };
  });
}

export async function deleteTagGroup(input: WithActor<DeleteInput>): Promise<VoidResult> {
  return run("novels.delete-tag-group", input.actorId, async (fail) => {
    if (!(await store.deleteGroup(input.id))) return fail("novels.tag_group_not_found", "Grupo não encontrado.");
    return { success: true as const, data: null };
  });
}

export async function reorderTagGroups(input: WithActor<ReorderInput>): Promise<VoidResult> {
  return run("novels.reorder-tag-groups", input.actorId, async () => {
    await store.reorderGroups([...new Set(input.orderedIds)]);
    return { success: true as const, data: null };
  });
}

export async function saveTag(input: WithActor<SaveTagInput>): Promise<SaveResult> {
  return run("novels.save-tag", input.actorId, async (fail) => {
    if (!(await store.findGroupById(input.groupId))) return fail("novels.tag_group_not_found", "Grupo não encontrado.");
    const sameSlug = await store.findTagBySlug(input.slug);
    if (sameSlug && sameSlug.id !== input.id) return fail("novels.tag_slug_taken", "Já existe uma tag com esse endereço.");
    const values = { ...input, name: names(input.name), description: normalizeLocalizedText(input.description ?? {}, LOCALES) };
    if (input.id) {
      if (!(await store.updateTag(input.id, values))) return fail("novels.tag_not_found", "Tag não encontrada.");
      return { success: true as const, data: { id: input.id } };
    }
    return { success: true as const, data: { id: await store.insertTag(values, input.actorId) } };
  });
}

export async function setTagArchived(input: WithActor<ArchiveInput>): Promise<VoidResult> {
  return run("novels.archive-tag", input.actorId, async (fail) => {
    if (!(await store.setTagArchived(input.id, input.archived))) return fail("novels.tag_not_found", "Tag não encontrada.");
    return { success: true as const, data: null };
  });
}

export async function deleteTag(input: WithActor<DeleteInput>): Promise<VoidResult> {
  return run("novels.delete-tag", input.actorId, async (fail) => {
    if (!(await store.deleteTag(input.id))) return fail("novels.tag_not_found", "Tag não encontrada.");
    return { success: true as const, data: null };
  });
}

export async function promoteTag(input: WithActor<DeleteInput>): Promise<VoidResult> {
  return run("novels.promote-tag", input.actorId, async (fail) => {
    const tag = await store.findTagById(input.id);
    if (!tag) return fail("novels.tag_not_found", "Tag não encontrada.");
    if (!tag.custom) return fail("novels.tag_not_custom", "Essa tag já está no catálogo.");
    await store.promoteTag(tag.id, tag.groupId);
    return { success: true as const, data: null };
  });
}

export async function reorderTags(input: WithActor<ReorderInput>): Promise<VoidResult> {
  return run("novels.reorder-tags", input.actorId, async (fail) => {
    if (!input.groupId || !(await store.findGroupById(input.groupId))) return fail("novels.tag_group_not_found", "Grupo não encontrado.");
    await store.reorderTags(input.groupId, [...new Set(input.orderedIds)]);
    return { success: true as const, data: null };
  });
}

export async function updateBadges(input: WithActor<UpdateBadgesInput>): Promise<VoidResult> {
  return run("novels.update-tag-badges", input.actorId, async () => {
    const badges = normalizeBadges(input.badges);
    await store.upsertBadges({
      interactive: normalizeLocalizedText(badges.interactive, LOCALES),
      textOnly: normalizeLocalizedText(badges.textOnly, LOCALES),
      aiAudio: normalizeLocalizedText(badges.aiAudio, LOCALES),
    });
    return { success: true as const, data: null };
  });
}

export async function installTagStarterPack(input: { actorId: string }): Promise<InstallStarterPackResult> {
  return run("novels.install-tag-starter-pack", input.actorId, async () => ({
    success: true as const,
    data: await store.installStarterPack(TAG_STARTER_PACK, DEFAULT_BADGES),
  }));
}
