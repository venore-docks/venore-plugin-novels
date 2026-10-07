"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isPluginActive } from "@venore/plugin-sdk";
import {
  createChapter,
  createWork,
  deleteCastMember,
  deleteChapter,
  deleteTag,
  deleteTagGroup,
  deleteWorkSpeech,
  generateWorkSpeech,
  deleteWork,
  installTagStarterPack,
  moveChapter,
  promoteTag,
  publishWork,
  reorderCast,
  reorderTagGroups,
  reorderTags,
  saveCastMember,
  saveChapterGraph,
  saveTag,
  saveTagGroup,
  setTagArchived,
  setTagGroupArchived,
  unpublishWork,
  updateChapter,
  updateTagBadges,
  updateWork,
  updateWorkVariables,
  type StoryIssue,
} from "../../index";
import type {
  AccentColor,
  CatalogBadges,
  CoverFocus,
  LocalizedText,
  TagCategory,
  TagSelection,
  VariableDefinition,
  WorkTagInput,
} from "../../contracts/types";
import {
  ADMIN_BASE_PATH,
  adminChapterPath,
  adminTagsPath,
  adminWorkPath,
  PLUGIN_KEY,
  PUBLIC_BASE_PATH,
} from "../../shared/constants";

export type AdminActionState = { error: string | null };
// Resultado das actions chamadas direto pelo client (sem <form>).
export type DirectActionResult = { ok: true; id?: string } | { ok: false; error: string };

const PLUGIN_DISABLED_ERROR = "O plugin Graphic Novels está desabilitado.";

async function pluginDisabled(): Promise<boolean> {
  return !(await isPluginActive(PLUGIN_KEY));
}

function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "");
}

function revalidateWork(workId: string) {
  revalidatePath(ADMIN_BASE_PATH);
  revalidatePath(adminWorkPath(workId));
  revalidatePath(PUBLIC_BASE_PATH, "layout");
}

function toDirect(result: { success: true; data: unknown } | { success: false; error: { message: string } }): DirectActionResult {
  if (!result.success) return { ok: false, error: result.error.message };
  const data = result.data as { id?: unknown } | null;
  return { ok: true, id: data && typeof data.id === "string" ? data.id : undefined };
}

const localized = (value: unknown): LocalizedText =>
  value && typeof value === "object"
    ? Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, String(entry ?? "")]))
    : {};
const tagInput = (value: unknown): WorkTagInput | undefined => {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as { tagIds?: unknown; newTags?: unknown };
  return {
    tagIds: Array.isArray(raw.tagIds) ? raw.tagIds.map(String).slice(0, 200) : [],
    newTags: Array.isArray(raw.newTags)
      ? raw.newTags.slice(0, 50).map((tag) => ({ groupId: String((tag as { groupId?: unknown }).groupId ?? ""), name: String((tag as { name?: unknown }).name ?? "") }))
      : [],
  };
};
const focus = (value: unknown): CoverFocus | null =>
  value && typeof value === "object" ? { x: Number((value as CoverFocus).x), y: Number((value as CoverFocus).y) } : null;

// ------------------------------------------------------------------ obra

export type CreateWorkPayload = {
  title: string;
  subtitle: string;
  synopsis: string;
  slug: string;
  defaultLocale: string;
  locales: string[];
  coverMediaId: string | null;
  coverFocus: CoverFocus | null;
  tags: WorkTagInput;
};

// Assistente de criação: cria e leva direto ao editor do primeiro capítulo.
export async function createWorkAction(payload: CreateWorkPayload): Promise<DirectActionResult> {
  if (await pluginDisabled()) return { ok: false, error: PLUGIN_DISABLED_ERROR };
  if (!payload || typeof payload !== "object") return { ok: false, error: "Dados do formulário inválidos." };
  const result = await createWork({
    title: String(payload.title ?? ""),
    subtitle: String(payload.subtitle ?? ""),
    synopsis: String(payload.synopsis ?? ""),
    slug: String(payload.slug ?? ""),
    defaultLocale: String(payload.defaultLocale ?? "pt-BR"),
    locales: Array.isArray(payload.locales) ? payload.locales.map(String) : undefined,
    coverMediaId: payload.coverMediaId ? String(payload.coverMediaId) : null,
    coverFocus: focus(payload.coverFocus),
    tags: tagInput(payload.tags),
  });
  if (!result.success) return { ok: false, error: result.error.message };
  revalidatePath(ADMIN_BASE_PATH);
  redirect(adminChapterPath(result.data.id, result.data.firstChapterId));
}

export type UpdateWorkPayload = {
  workId: string;
  slug: string;
  title: LocalizedText;
  subtitle: LocalizedText;
  synopsis: LocalizedText;
  defaultLocale: string;
  locales: string[];
  coverMediaId: string | null;
  coverFocus: CoverFocus | null;
  tags: WorkTagInput;
};

// Aba Configurações: identidade, idiomas e tags (JSON: traduções e tags são listas dinâmicas no client).
export async function updateWorkAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  if (await pluginDisabled()) return { error: PLUGIN_DISABLED_ERROR };
  let payload: UpdateWorkPayload;
  try {
    payload = JSON.parse(text(formData, "payload")) as UpdateWorkPayload;
  } catch {
    return { error: "Dados do formulário inválidos." };
  }
  if (!payload || typeof payload !== "object" || typeof payload.workId !== "string") {
    return { error: "Dados do formulário inválidos." };
  }
  const result = await updateWork({
    workId: payload.workId,
    slug: String(payload.slug ?? ""),
    title: localized(payload.title),
    subtitle: localized(payload.subtitle),
    synopsis: localized(payload.synopsis),
    defaultLocale: String(payload.defaultLocale ?? ""),
    locales: Array.isArray(payload.locales) ? payload.locales.map(String) : [],
    coverMediaId: payload.coverMediaId ? String(payload.coverMediaId) : null,
    coverFocus: focus(payload.coverFocus),
    tags: tagInput(payload.tags),
  });
  if (!result.success) return { error: result.error.message };
  revalidateWork(payload.workId);
  return { error: null };
}

// Aba Sistema: variáveis da obra.
export async function updateWorkVariablesAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  if (await pluginDisabled()) return { error: PLUGIN_DISABLED_ERROR };
  let payload: { workId: string; variables: VariableDefinition[] };
  try {
    payload = JSON.parse(text(formData, "payload"));
  } catch {
    return { error: "Dados do formulário inválidos." };
  }
  if (!payload || typeof payload.workId !== "string") return { error: "Dados do formulário inválidos." };
  const result = await updateWorkVariables({
    workId: payload.workId,
    variables: Array.isArray(payload.variables) ? payload.variables : [],
  });
  if (!result.success) return { error: result.error.message };
  revalidateWork(payload.workId);
  return { error: null };
}

export async function deleteWorkAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  if (await pluginDisabled()) return { error: PLUGIN_DISABLED_ERROR };
  const result = await deleteWork({ workId: text(formData, "workId") });
  if (!result.success) return { error: result.error.message };
  revalidatePath(ADMIN_BASE_PATH);
  redirect(ADMIN_BASE_PATH);
}

export async function publishWorkAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  if (await pluginDisabled()) return { error: PLUGIN_DISABLED_ERROR };
  const workId = text(formData, "workId");
  const result = formData.get("intent") === "unpublish" ? await unpublishWork({ workId }) : await publishWork({ workId });
  if (!result.success) return { error: result.error.message };
  revalidateWork(workId);
  return { error: null };
}

// ------------------------------------------------------------------ capítulos e grafo

export async function createChapterAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  if (await pluginDisabled()) return { error: PLUGIN_DISABLED_ERROR };
  const workId = text(formData, "workId");
  const result = await createChapter({ workId, title: text(formData, "title") });
  if (!result.success) return { error: result.error.message };
  revalidateWork(workId);
  return { error: null };
}

export async function updateChapterAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  if (await pluginDisabled()) return { error: PLUGIN_DISABLED_ERROR };
  const workId = text(formData, "workId");
  const title: LocalizedText = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("title.") && typeof value === "string") title[key.slice("title.".length)] = value;
  }
  const result = await updateChapter({ chapterId: text(formData, "chapterId"), title });
  if (!result.success) return { error: result.error.message };
  revalidateWork(workId);
  return { error: null };
}

export async function deleteChapterAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  if (await pluginDisabled()) return { error: PLUGIN_DISABLED_ERROR };
  const result = await deleteChapter({ chapterId: text(formData, "chapterId") });
  if (!result.success) return { error: result.error.message };
  revalidateWork(result.data.workId);
  return { error: null };
}

export async function moveChapterAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  if (await pluginDisabled()) return { error: PLUGIN_DISABLED_ERROR };
  const direction = text(formData, "direction") === "up" ? "up" : "down";
  const result = await moveChapter({ chapterId: text(formData, "chapterId"), direction });
  if (!result.success) return { error: result.error.message };
  revalidateWork(result.data.workId);
  return { error: null };
}

export type SaveGraphActionResult =
  | { ok: true; savedAt: string; issues: StoryIssue[] }
  | { ok: false; error: string };

// Chamada direta do editor em grafo (não via <form>): o grafo inteiro vai como objeto.
export async function saveChapterGraphAction(workId: string, chapterId: string, graph: unknown): Promise<SaveGraphActionResult> {
  if (await pluginDisabled()) return { ok: false, error: PLUGIN_DISABLED_ERROR };
  const result = await saveChapterGraph({ workId: String(workId), chapterId: String(chapterId), graph });
  if (!result.success) return { ok: false, error: result.error.message };
  revalidateWork(String(workId));
  revalidatePath(adminChapterPath(String(workId), String(chapterId)));
  return { ok: true, savedAt: result.data.savedAt.toISOString(), issues: result.data.issues };
}

// ------------------------------------------------------------------ áudio

// Aba "Áudio" da obra: gerar o que falta ou mudou ("missing"), refazer tudo ("all") ou apagar.
export async function generateWorkSpeechAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  if (await pluginDisabled()) return { error: PLUGIN_DISABLED_ERROR };
  const workId = text(formData, "workId");
  const result = await generateWorkSpeech({ workId, mode: formData.get("mode") === "all" ? "all" : "missing" });
  if (!result.success) return { error: result.error.message };
  revalidateWork(workId);
  return { error: null };
}

export async function deleteWorkSpeechAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  if (await pluginDisabled()) return { error: PLUGIN_DISABLED_ERROR };
  const workId = text(formData, "workId");
  const result = await deleteWorkSpeech({ workId });
  if (!result.success) return { error: result.error.message };
  revalidateWork(workId);
  return { error: null };
}

// ------------------------------------------------------------------ elenco

export async function saveCastMemberAction(input: {
  workId: string;
  id: string | null;
  name: LocalizedText;
  color: AccentColor;
  portraitMediaId: string | null;
}): Promise<DirectActionResult> {
  if (await pluginDisabled()) return { ok: false, error: PLUGIN_DISABLED_ERROR };
  const workId = String(input?.workId ?? "");
  const result = await saveCastMember({
    workId,
    id: input?.id ? String(input.id) : null,
    name: localized(input?.name),
    color: String(input?.color ?? "primary") as AccentColor,
    portraitMediaId: input?.portraitMediaId ? String(input.portraitMediaId) : null,
  });
  if (result.success) revalidateWork(workId);
  return toDirect(result);
}

export async function deleteCastMemberAction(workId: string, id: string): Promise<DirectActionResult> {
  if (await pluginDisabled()) return { ok: false, error: PLUGIN_DISABLED_ERROR };
  const result = await deleteCastMember({ workId: String(workId), id: String(id) });
  if (result.success) revalidateWork(String(workId));
  return toDirect(result);
}

export async function reorderCastAction(workId: string, orderedIds: string[]): Promise<DirectActionResult> {
  if (await pluginDisabled()) return { ok: false, error: PLUGIN_DISABLED_ERROR };
  const result = await reorderCast({ workId: String(workId), orderedIds: Array.isArray(orderedIds) ? orderedIds.map(String) : [] });
  if (result.success) revalidateWork(String(workId));
  return toDirect(result);
}

// ------------------------------------------------------------------ catálogo de tags

function revalidateTags() {
  revalidatePath(adminTagsPath);
  revalidatePath(ADMIN_BASE_PATH, "layout");
  revalidatePath(PUBLIC_BASE_PATH, "layout");
}

export async function saveTagGroupAction(input: {
  id: string | null;
  key: string;
  name: LocalizedText;
  category: TagCategory;
  selection: TagSelection;
  required: boolean;
  allowCustom: boolean;
  showOnCard: boolean;
}): Promise<DirectActionResult> {
  if (await pluginDisabled()) return { ok: false, error: PLUGIN_DISABLED_ERROR };
  const result = await saveTagGroup({
    id: input?.id ? String(input.id) : null,
    key: String(input?.key ?? ""),
    name: localized(input?.name),
    category: input?.category === "production" ? "production" : "info",
    selection: input?.selection === "single" ? "single" : "multiple",
    required: Boolean(input?.required),
    allowCustom: Boolean(input?.allowCustom),
    showOnCard: Boolean(input?.showOnCard),
  });
  if (result.success) revalidateTags();
  return toDirect(result);
}

export async function setTagGroupArchivedAction(id: string, archived: boolean): Promise<DirectActionResult> {
  if (await pluginDisabled()) return { ok: false, error: PLUGIN_DISABLED_ERROR };
  const result = await setTagGroupArchived({ id: String(id), archived: Boolean(archived) });
  if (result.success) revalidateTags();
  return toDirect(result);
}

export async function deleteTagGroupAction(id: string): Promise<DirectActionResult> {
  if (await pluginDisabled()) return { ok: false, error: PLUGIN_DISABLED_ERROR };
  const result = await deleteTagGroup({ id: String(id) });
  if (result.success) revalidateTags();
  return toDirect(result);
}

export async function reorderTagGroupsAction(orderedIds: string[]): Promise<DirectActionResult> {
  if (await pluginDisabled()) return { ok: false, error: PLUGIN_DISABLED_ERROR };
  const result = await reorderTagGroups({ orderedIds: Array.isArray(orderedIds) ? orderedIds.map(String) : [] });
  if (result.success) revalidateTags();
  return toDirect(result);
}

export async function saveTagAction(input: {
  id: string | null;
  groupId: string;
  slug: string;
  name: LocalizedText;
  description: LocalizedText;
}): Promise<DirectActionResult> {
  if (await pluginDisabled()) return { ok: false, error: PLUGIN_DISABLED_ERROR };
  const result = await saveTag({
    id: input?.id ? String(input.id) : null,
    groupId: String(input?.groupId ?? ""),
    slug: String(input?.slug ?? ""),
    name: localized(input?.name),
    description: localized(input?.description),
  });
  if (result.success) revalidateTags();
  return toDirect(result);
}

export async function setTagArchivedAction(id: string, archived: boolean): Promise<DirectActionResult> {
  if (await pluginDisabled()) return { ok: false, error: PLUGIN_DISABLED_ERROR };
  const result = await setTagArchived({ id: String(id), archived: Boolean(archived) });
  if (result.success) revalidateTags();
  return toDirect(result);
}

export async function deleteTagAction(id: string): Promise<DirectActionResult> {
  if (await pluginDisabled()) return { ok: false, error: PLUGIN_DISABLED_ERROR };
  const result = await deleteTag({ id: String(id) });
  if (result.success) revalidateTags();
  return toDirect(result);
}

export async function promoteTagAction(id: string): Promise<DirectActionResult> {
  if (await pluginDisabled()) return { ok: false, error: PLUGIN_DISABLED_ERROR };
  const result = await promoteTag({ id: String(id) });
  if (result.success) revalidateTags();
  return toDirect(result);
}

export async function reorderTagsAction(groupId: string, orderedIds: string[]): Promise<DirectActionResult> {
  if (await pluginDisabled()) return { ok: false, error: PLUGIN_DISABLED_ERROR };
  const result = await reorderTags({ groupId: String(groupId), orderedIds: Array.isArray(orderedIds) ? orderedIds.map(String) : [] });
  if (result.success) revalidateTags();
  return toDirect(result);
}

export async function updateTagBadgesAction(badges: CatalogBadges): Promise<DirectActionResult> {
  if (await pluginDisabled()) return { ok: false, error: PLUGIN_DISABLED_ERROR };
  const result = await updateTagBadges({
    badges: { interactive: localized(badges?.interactive), textOnly: localized(badges?.textOnly), aiAudio: localized(badges?.aiAudio) },
  });
  if (result.success) revalidateTags();
  return toDirect(result);
}

export async function installTagStarterPackAction(): Promise<DirectActionResult> {
  if (await pluginDisabled()) return { ok: false, error: PLUGIN_DISABLED_ERROR };
  const result = await installTagStarterPack();
  if (result.success) revalidateTags();
  return toDirect(result);
}
