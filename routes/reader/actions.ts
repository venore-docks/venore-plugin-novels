"use server";

import { isPluginActive } from "@venore/plugin-sdk";
import { getReaderStats, saveReaderProgress, startReaderGame } from "../../index";
import type { ReaderStats } from "../../shared/reader-stats";
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

// Desempenho atualizado depois de uma jornada (tela de fim).
export async function getReaderStatsAction(workId: string): Promise<ReaderStats | null> {
  if (!(await isPluginActive(PLUGIN_KEY))) return null;
  const result = await getReaderStats({ workId: String(workId) });
  return result.success ? result.data : null;
}
