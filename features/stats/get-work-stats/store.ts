import { count, desc, eq } from "drizzle-orm";
import { db } from "@venore/plugin-sdk";
import { readerProgress } from "../../../database/schema";

export { findStoryRecords, findWorkRowById as findWorkById } from "../../../database/queries/story-records";

export async function countProgress(workId: string): Promise<number> {
  const [row] = await db.select({ total: count() }).from(readerProgress).where(eq(readerProgress.workId, workId));
  return row?.total ?? 0;
}

export async function findProgressSample(workId: string, limit: number) {
  const rows = await db
    .select({ state: readerProgress.state })
    .from(readerProgress)
    .where(eq(readerProgress.workId, workId))
    .orderBy(desc(readerProgress.updatedAt))
    .limit(limit);
  return rows.map((row) => row.state);
}
