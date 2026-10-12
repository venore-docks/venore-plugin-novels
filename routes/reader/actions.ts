"use server";

import { isPluginActive } from "@venore/plugin-sdk";
import { deleteReaderSlot, listReaderSaves, loadReaderSlot, saveReaderProgress, saveReaderSlot, startReaderGame } from "../../index";
import type { ReaderSaveSlot } from "../../features/reading/manage-reader-saves/types";
import { PLUGIN_KEY } from "../../shared/constants";
import type { SavedGame } from "../../shared/engine/types";

// Sem sessão, os handlers recusam antes de tocar no banco: quem lê sem login fica só com o
// progresso local do navegador.
export async function saveReaderProgressAction(workId: string, state: unknown): Promise<{ ok: boolean; truncated?: boolean; error?: string }> {
  if (!(await isPluginActive(PLUGIN_KEY))) return { ok: false };
  const result = await saveReaderProgress({ workId: String(workId), state });
  return result.success ? { ok: true, truncated: result.data.truncated } : { ok: false, error: result.error.code };
}

export async function startReaderGameAction(workId: string, start: unknown): Promise<{ ok: true; saved: SavedGame } | { ok: false; error: string }> {
  if (!(await isPluginActive(PLUGIN_KEY))) return { ok: false, error: "Indisponível." };
  const result = await startReaderGame({ workId: String(workId), start });
  return result.success ? { ok: true, saved: result.data } : { ok: false, error: result.error.message };
}

export async function listReaderSavesAction(workId: string): Promise<ReaderSaveSlot[]> {
  if (!(await isPluginActive(PLUGIN_KEY))) return [];
  const result = await listReaderSaves({ workId: String(workId) });
  return result.success ? result.data : [];
}

export async function saveReaderSlotAction(workId: string, slot: number, name: string, state: unknown): Promise<{ ok: boolean; error?: string }> {
  if (!(await isPluginActive(PLUGIN_KEY))) return { ok: false, error: "Indisponível." };
  const result = await saveReaderSlot({ workId: String(workId), slot: Number(slot), name: String(name ?? ""), state });
  return result.success ? { ok: true } : { ok: false, error: result.error.message };
}

export async function loadReaderSlotAction(workId: string, slot: number): Promise<{ ok: true; saved: SavedGame } | { ok: false; error: string }> {
  if (!(await isPluginActive(PLUGIN_KEY))) return { ok: false, error: "Indisponível." };
  const result = await loadReaderSlot({ workId: String(workId), slot: Number(slot) });
  return result.success ? { ok: true, saved: result.data } : { ok: false, error: result.error.message };
}

export async function deleteReaderSlotAction(workId: string, slot: number): Promise<{ ok: boolean }> {
  if (!(await isPluginActive(PLUGIN_KEY))) return { ok: false };
  const result = await deleteReaderSlot({ workId: String(workId), slot: Number(slot) });
  return { ok: result.success };
}
