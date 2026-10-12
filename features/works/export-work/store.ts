import { eq } from "drizzle-orm";
import { db } from "@venore/plugin-sdk";
import { tags, workTags } from "../../../database/schema";
import { findStoryRecords, findWorkRowById } from "../../../database/queries/story-records";

export { findStoryRecords, findWorkRowById as findWorkById };

export async function findWorkTagSlugs(workId: string): Promise<string[]> {
  const rows = await db.select({ slug: tags.slug }).from(workTags).innerJoin(tags, eq(tags.id, workTags.tagId)).where(eq(workTags.workId, workId));
  return rows.map((row) => row.slug);
}
