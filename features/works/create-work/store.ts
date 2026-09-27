import { db } from "@venore/plugin-sdk";
import { chapters, works } from "../../../database/schema";
import { findWorkRowBySlug, toWorkRecord } from "../../../database/queries/story-records";
import type { LocalizedText, WorkRecord } from "../../../contracts/types";

export { findWorkRowBySlug as findWorkBySlug };

// Obra nasce com um capítulo vazio: o editor em grafo trabalha por capítulo, e uma obra sem
// capítulo não teria onde começar a desenhar.
export async function insertWorkWithFirstChapter(input: {
  slug: string;
  title: LocalizedText;
  defaultLocale: string;
  authorUserId: string;
  firstChapterTitle: LocalizedText;
}): Promise<WorkRecord> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(works)
      .values({
        slug: input.slug,
        title: input.title,
        defaultLocale: input.defaultLocale,
        locales: [input.defaultLocale],
        authorUserId: input.authorUserId,
      })
      .returning();
    await tx.insert(chapters).values({ workId: row.id, position: 1, title: input.firstChapterTitle });
    return toWorkRecord(row);
  });
}
