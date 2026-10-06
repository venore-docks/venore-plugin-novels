import { eq } from "drizzle-orm";
import { db } from "@venore/plugin-sdk";
import { works } from "../../../database/schema";
import {
  findStoryRecords,
  findWorkRowById,
  findWorkRowBySlug,
  toWorkRecord,
} from "../../../database/queries/story-records";
import type { LocalizedText, VariableDefinition, WorkRecord } from "../../../contracts/types";

export { findStoryRecords, findWorkRowById as findWorkById, findWorkRowBySlug as findWorkBySlug };

export async function updateWorkRow(
  workId: string,
  values: {
    slug: string;
    title: LocalizedText;
    synopsis: LocalizedText;
    defaultLocale: string;
    locales: string[];
    coverMediaId: string | null;
    variables: VariableDefinition[];
    speechEnabled: boolean;
  },
): Promise<WorkRecord> {
  const [row] = await db
    .update(works)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(works.id, workId))
    .returning();
  return toWorkRecord(row);
}
