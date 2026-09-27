import { eq } from "drizzle-orm";
import { db } from "@venore/plugin-sdk";
import { works } from "../../../database/schema";

// Capítulos, cenas, escolhas e progresso de leitores caem junto (ON DELETE CASCADE).
export async function deleteWorkRow(workId: string): Promise<boolean> {
  const rows = await db.delete(works).where(eq(works.id, workId)).returning({ id: works.id });
  return rows.length > 0;
}
