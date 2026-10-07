import { eq } from "drizzle-orm";
import { db } from "@venore/plugin-sdk";
import { works } from "../../../database/schema";
import { findStoryRecords, findWorkRowById, findWorkRowBySlug, toWorkRecord } from "../../../database/queries/story-records";
import { findTagCatalog, findWorkTagIds, replaceWorkTags } from "../../../database/queries/tag-records";
import type { CoverFocus, LocalizedText, WorkRecord, WorkTagInput } from "../../../contracts/types";

export { findStoryRecords, findTagCatalog, findWorkTagIds, findWorkRowById as findWorkById, findWorkRowBySlug as findWorkBySlug };

export async function updateWorkRow(
  workId: string,
  values: {
    slug: string;
    title: LocalizedText;
    subtitle: LocalizedText;
    synopsis: LocalizedText;
    defaultLocale: string;
    locales: string[];
    coverMediaId: string | null;
    coverFocus: CoverFocus | null;
  },
  tags: { input: WorkTagInput; actorId: string } | null,
): Promise<WorkRecord> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(works)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(works.id, workId))
      .returning();
    if (tags) await replaceWorkTags(tx, workId, tags.input, { actorId: tags.actorId, locale: values.defaultLocale });
    return toWorkRecord(row);
  });
}
