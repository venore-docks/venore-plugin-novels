import { and, eq } from "drizzle-orm";
import { db } from "@venore/plugin-sdk";
import { readerProgress } from "../../../database/schema";

export async function findReaderProgress(userId: string, workId: string) {
  const [row] = await db
    .select({ state: readerProgress.state, updatedAt: readerProgress.updatedAt })
    .from(readerProgress)
    .where(and(eq(readerProgress.userId, userId), eq(readerProgress.workId, workId)))
    .limit(1);
  return row ?? null;
}
