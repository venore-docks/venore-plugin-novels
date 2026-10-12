import { eq } from "drizzle-orm";
import { db } from "@venore/plugin-sdk";
import type { GameSystem } from "../../../contracts/game";
import { works } from "../../../database/schema";
import { findStoryRecords, findWorkRowById } from "../../../database/queries/story-records";

export { findStoryRecords, findWorkRowById as findWorkById };

export async function updateGameSystemRow(workId: string, system: GameSystem): Promise<void> {
  await db.update(works).set({ gameSystem: system, updatedAt: new Date() }).where(eq(works.id, workId));
}
