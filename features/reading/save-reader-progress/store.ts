import { and, eq } from "drizzle-orm";
import { db } from "@venore/plugin-sdk";
import { readerProgress, readerWorkStats } from "../../../database/schema";
import type { ReaderState } from "../../../contracts/types";
import type { SavedGame } from "../../../shared/engine/types";
import { EMPTY_READER_STATS, type ReaderStats } from "../../../shared/reader-stats";

export { findStoryRecords, findWorkRowById as findWorkById } from "../../../database/queries/story-records";

export async function findStoredProgress(userId: string, workId: string): Promise<SavedGame | null> {
  const [row] = await db
    .select({ state: readerProgress.state })
    .from(readerProgress)
    .where(and(eq(readerProgress.userId, userId), eq(readerProgress.workId, workId)))
    .limit(1);
  const state = row?.state as Partial<SavedGame> | undefined;
  return state?.v === 2 && typeof state.seed === "string" && Array.isArray(state.log) ? (state as SavedGame) : null;
}

export async function findReaderStats(userId: string, workId: string): Promise<ReaderStats | null> {
  const [row] = await db
    .select()
    .from(readerWorkStats)
    .where(and(eq(readerWorkStats.userId, userId), eq(readerWorkStats.workId, workId)))
    .limit(1);
  return row
    ? {
        completions: row.completions,
        lastCompletedSeed: row.lastCompletedSeed,
        scenesSeen: row.scenesSeen,
        choicesSeen: row.choicesSeen,
        endingsSeen: row.endingsSeen,
        achievements: row.achievements,
      }
    : null;
}

export async function upsertReaderProgress(userId: string, workId: string, state: ReaderState | SavedGame): Promise<Date> {
  const updatedAt = new Date();
  await db
    .insert(readerProgress)
    .values({ userId, workId, state, updatedAt })
    .onConflictDoUpdate({ target: [readerProgress.userId, readerProgress.workId], set: { state, updatedAt } });
  return updatedAt;
}

// Progresso e desempenho na mesma transação (o desempenho lê o atual com lock da linha).
export async function saveProgressAndStats(
  userId: string,
  workId: string,
  state: SavedGame,
  merge: (current: ReaderStats) => ReaderStats,
): Promise<Date> {
  const updatedAt = new Date();
  await db.transaction(async (tx) => {
    await tx
      .insert(readerProgress)
      .values({ userId, workId, state, updatedAt })
      .onConflictDoUpdate({ target: [readerProgress.userId, readerProgress.workId], set: { state, updatedAt } });
    const [row] = await tx
      .select()
      .from(readerWorkStats)
      .where(and(eq(readerWorkStats.userId, userId), eq(readerWorkStats.workId, workId)))
      .for("update")
      .limit(1);
    const next = merge(row ?? EMPTY_READER_STATS);
    await tx
      .insert(readerWorkStats)
      .values({ userId, workId, ...next, updatedAt })
      .onConflictDoUpdate({ target: [readerWorkStats.userId, readerWorkStats.workId], set: { ...next, updatedAt } });
  });
  return updatedAt;
}
