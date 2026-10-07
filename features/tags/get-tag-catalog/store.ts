import { count } from "drizzle-orm";
import { db } from "@venore/plugin-sdk";
import { workTags } from "../../../database/schema";

export { findTagCatalog } from "../../../database/queries/tag-records";

export async function countWorksPerTag(): Promise<Record<string, number>> {
  const rows = await db.select({ tagId: workTags.tagId, works: count() }).from(workTags).groupBy(workTags.tagId);
  return Object.fromEntries(rows.map((row) => [row.tagId, row.works]));
}
