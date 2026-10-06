"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isPluginActive } from "@venore/plugin-sdk";
import {
  createChapter,
  createWork,
  deleteChapter,
  deleteWork,
  moveChapter,
  publishWork,
  saveChapterGraph,
  unpublishWork,
  updateChapter,
  updateWork,
  type StoryIssue,
} from "../../index";
import type { LocalizedText, VariableDefinition } from "../../contracts/types";
import { ADMIN_BASE_PATH, adminChapterPath, adminWorkPath, PLUGIN_KEY, PUBLIC_BASE_PATH } from "../../shared/constants";

export type AdminActionState = { error: string | null };

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

export async function createWorkAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  if (await pluginDisabled()) return { error: PLUGIN_DISABLED_ERROR };
  const result = await createWork({
    title: text(formData, "title"),
    slug: text(formData, "slug"),
    defaultLocale: text(formData, "defaultLocale") || "pt-BR",
  });
  if (!result.success) return { error: result.error.message };
  revalidatePath(ADMIN_BASE_PATH);
  redirect(adminWorkPath(result.data.id));
}

export type UpdateWorkPayload = {
  workId: string;
  slug: string;
  title: LocalizedText;
  synopsis: LocalizedText;
  defaultLocale: string;
  locales: string[];
  coverMediaId: string | null;
  variables: VariableDefinition[];
  speechEnabled: boolean;
};

// Formulário de obra manda JSON (traduções e variáveis são listas dinâmicas no client).
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
    title: payload.title ?? {},
    synopsis: payload.synopsis ?? {},
    defaultLocale: String(payload.defaultLocale ?? ""),
    locales: Array.isArray(payload.locales) ? payload.locales.map(String) : [],
    coverMediaId: payload.coverMediaId ? String(payload.coverMediaId) : null,
    variables: Array.isArray(payload.variables) ? payload.variables : [],
    speechEnabled: payload.speechEnabled === true,
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
