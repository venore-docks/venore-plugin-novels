import { eq } from "drizzle-orm";
import { db } from "@venore/plugin-sdk";
import { chapters, scenes, works } from "../../../database/schema";
import { findWorkRowBySlug, toWorkRecord } from "../../../database/queries/story-records";
import { findTagCatalog, replaceWorkTags } from "../../../database/queries/tag-records";
import type { CoverFocus, LocalizedText, SceneBlock, WorkRecord, WorkTagInput } from "../../../contracts/types";

export { findWorkRowBySlug as findWorkBySlug, findTagCatalog };

// Obra nasce com um capítulo e uma cena inicial: o assistente leva direto ao editor do capítulo,
// pronto para escrever.
export async function insertWorkWithFirstChapter(input: {
  slug: string;
  title: LocalizedText;
  subtitle: LocalizedText;
  synopsis: LocalizedText;
  defaultLocale: string;
  locales: string[];
  coverMediaId: string | null;
  coverFocus: CoverFocus | null;
  authorUserId: string;
  firstChapterTitle: LocalizedText;
  firstSceneLabel: string;
  firstSceneBlocks: SceneBlock[];
  tags: WorkTagInput;
}): Promise<WorkRecord & { firstChapterId: string }> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(works)
      .values({
        slug: input.slug,
        title: input.title,
        subtitle: input.subtitle,
        synopsis: input.synopsis,
        defaultLocale: input.defaultLocale,
        locales: input.locales,
        coverMediaId: input.coverMediaId,
        coverFocus: input.coverFocus,
        authorUserId: input.authorUserId,
      })
      .returning();
    const [chapter] = await tx.insert(chapters).values({ workId: row.id, position: 1, title: input.firstChapterTitle }).returning();
    const sceneId = crypto.randomUUID();
    await tx.insert(scenes).values({ id: sceneId, workId: row.id, chapterId: chapter.id, label: input.firstSceneLabel, blocks: input.firstSceneBlocks });
    await tx.update(chapters).set({ startSceneId: sceneId }).where(eq(chapters.id, chapter.id));
    if (input.tags.tagIds.length > 0 || input.tags.newTags.length > 0) {
      await replaceWorkTags(tx, row.id, input.tags, { actorId: input.authorUserId, locale: input.defaultLocale });
    }
    return { ...toWorkRecord(row), firstChapterId: chapter.id };
  });
}
