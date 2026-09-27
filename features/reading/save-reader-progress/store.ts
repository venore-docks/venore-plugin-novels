import { db } from "@venore/plugin-sdk";
import { readerProgress } from "../../../database/schema";
import type { ReaderState } from "../../../contracts/types";

export { findWorkRowById as findWorkById } from "../../../database/queries/story-records";

export async function upsertReaderProgress(userId: string, workId: string, state: ReaderState): Promise<Date> {
  const updatedAt = new Date();
  await db
    .insert(readerProgress)
    .values({ userId, workId, state, updatedAt })
    .onConflictDoUpdate({ target: [readerProgress.userId, readerProgress.workId], set: { state, updatedAt } });
  return updatedAt;
}
