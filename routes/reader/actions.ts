"use server";

import { isPluginActive } from "@venore/plugin-sdk";
import { saveReaderProgress } from "../../index";
import { PLUGIN_KEY } from "../../shared/constants";

// Sem sessão, o handler recusa antes de tocar no banco: quem lê sem login fica só com o
// progresso local do navegador.
export async function saveReaderProgressAction(workId: string, state: unknown): Promise<{ ok: boolean }> {
  if (!(await isPluginActive(PLUGIN_KEY))) return { ok: false };
  const result = await saveReaderProgress({ workId: String(workId), state });
  return { ok: result.success };
}
