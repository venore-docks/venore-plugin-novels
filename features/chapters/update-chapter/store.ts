import { eq } from "drizzle-orm";
import { db } from "@venore/plugin-sdk";
import { chapters } from "../../../database/schema";
import type { ChapterRecord, LocalizedText } from "../../../contracts/types";

export { findChapterWithWork } from "../../../database/queries/story-records";

export async function updateChapterTitle(chapterId: string, title: LocalizedText): Promise<ChapterRecord> {
  const [row] = await db.update(chapters).set({ title, updatedAt: new Date() }).where(eq(chapters.id, chapterId)).returning();
  return row;
}
