import { and, eq } from "drizzle-orm";
import { db } from "@venore/plugin-sdk";
import { readerProgress } from "../../../database/schema";
import type { ReaderState } from "../../../contracts/types";
import type { SavedGame } from "../../../shared/engine/types";

export { findStoryRecords, findWorkRowById as findWorkById } from "../../../database/queries/story-records";

export async function findProgressSeed(userId: string, workId: string): Promise<string | null> {
  const [row] = await db
    .select({ state: readerProgress.state })
    .from(readerProgress)
    .where(and(eq(readerProgress.userId, userId), eq(readerProgress.workId, workId)))
    .limit(1);
  const state = row?.state as Partial<SavedGame> | undefined;
  return state?.v === 2 && typeof state.seed === "string" ? state.seed : null;
}

export async function upsertReaderProgress(userId: string, workId: string, state: ReaderState | SavedGame): Promise<Date> {
  const updatedAt = new Date();
  await db
    .insert(readerProgress)
    .values({ userId, workId, state, updatedAt })
    .onConflictDoUpdate({ target: [readerProgress.userId, readerProgress.workId], set: { state, updatedAt } });
  return updatedAt;
}
