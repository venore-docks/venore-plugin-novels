import { getCurrentUser } from "@venore/plugin-sdk/auth";
import { getSeriesCarry } from "./service";
import type { GetSeriesCarryInput, GetSeriesCarryResult } from "./types";

// Série (variáveis entre obras): sem conta não há como ler a partida da obra anterior.
export async function getSeriesCarryHandler(input: GetSeriesCarryInput): Promise<GetSeriesCarryResult> {
  const user = await getCurrentUser();
  if (!user.success || !user.data || typeof input.workId !== "string") return { success: true, data: {} };
  return getSeriesCarry({ workId: input.workId, userId: user.data.id });
}
