import { and, eq } from "drizzle-orm";
import { db } from "@venore/plugin-sdk";
import type { ReaderState } from "../../../contracts/types";
import { readerProgress } from "../../../database/schema";
import type { SavedGame } from "../../../shared/engine/types";

export { findStoryRecords, findWorkRowById as findWorkById } from "../../../database/queries/story-records";

export async function findProgressState(userId: string, workId: string): Promise<SavedGame | ReaderState | null> {
  const [row] = await db
    .select({ state: readerProgress.state })
    .from(readerProgress)
    .where(and(eq(readerProgress.userId, userId), eq(readerProgress.workId, workId)))
    .limit(1);
  return row?.state ?? null;
}
