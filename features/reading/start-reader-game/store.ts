import { and, eq } from "drizzle-orm";
import { db } from "@venore/plugin-sdk";
import { readerProgress } from "../../../database/schema";
import type { SavedGame } from "../../../shared/engine/types";

export { findStoryRecords, findWorkRowById as findWorkById } from "../../../database/queries/story-records";
export { upsertReaderProgress } from "../save-reader-progress/store";

export async function findCarriedProgress(userId: string, workId: string): Promise<{ visitedEndings: string[]; achievements: string[] }> {
  const [row] = await db
    .select({ state: readerProgress.state })
    .from(readerProgress)
    .where(and(eq(readerProgress.userId, userId), eq(readerProgress.workId, workId)))
    .limit(1);
  const state = (row?.state ?? {}) as Partial<SavedGame>;
  const strings = (value: unknown) => (Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string").slice(0, 300) : []);
  return { visitedEndings: strings(state.visitedEndings), achievements: strings(state.achievements) };
}
