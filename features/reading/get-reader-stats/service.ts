import { findReaderStats } from "./store";
import type { GetReaderStatsResult } from "./types";

// Desempenho do leitor na obra (jornadas, o que já viu, conquistas): o leitor calcula as
// conquistas com a obra em mãos (shared/reader-stats.ts).
export async function getReaderStats(input: { workId: string; userId: string }): Promise<GetReaderStatsResult> {
  return { success: true, data: await findReaderStats(input.userId, input.workId) };
}
