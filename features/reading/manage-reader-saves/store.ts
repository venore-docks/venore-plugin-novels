import { and, asc, eq } from "drizzle-orm";
import { db } from "@venore/plugin-sdk";
import type { LocalizedText } from "../../../contracts/types";
import { readerSaves } from "../../../database/schema";
import type { SavedGame } from "../../../shared/engine/types";
import type { ReaderSaveSlot } from "./types";

export { findStoryRecords, findWorkRowById as findWorkById } from "../../../database/queries/story-records";
export { upsertReaderProgress } from "../save-reader-progress/store";

export async function findSaves(userId: string, workId: string): Promise<ReaderSaveSlot[]> {
  const rows = await db
    .select()
    .from(readerSaves)
    .where(and(eq(readerSaves.userId, userId), eq(readerSaves.workId, workId)))
    .orderBy(asc(readerSaves.slot));
  return rows.map((row) => ({ slot: row.slot, name: row.name, chapterTitle: row.sceneLabel, state: row.state, updatedAt: row.updatedAt }));
}

export async function upsertSave(
  userId: string,
  workId: string,
  values: { slot: number; name: string; chapterTitle: LocalizedText; state: SavedGame },
): Promise<ReaderSaveSlot> {
  const updatedAt = new Date();
  const set = { name: values.name, sceneLabel: values.chapterTitle, state: values.state, updatedAt };
  await db
    .insert(readerSaves)
    .values({ userId, workId, slot: values.slot, ...set })
    .onConflictDoUpdate({ target: [readerSaves.userId, readerSaves.workId, readerSaves.slot], set });
  return { ...values, updatedAt };
}

export async function deleteSave(userId: string, workId: string, slot: number): Promise<void> {
  await db.delete(readerSaves).where(and(eq(readerSaves.userId, userId), eq(readerSaves.workId, workId), eq(readerSaves.slot, slot)));
}
