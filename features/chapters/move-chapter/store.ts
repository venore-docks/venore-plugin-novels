import { eq } from "drizzle-orm";
import { db } from "@venore/plugin-sdk";
import { chapters } from "../../../database/schema";

export { findChapterWithWork, findStoryRecords } from "../../../database/queries/story-records";

export async function swapChapterPositions(
  a: { id: string; position: number },
  b: { id: string; position: number },
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.update(chapters).set({ position: b.position }).where(eq(chapters.id, a.id));
    await tx.update(chapters).set({ position: a.position }).where(eq(chapters.id, b.id));
  });
}
