import { eq } from "drizzle-orm";
import { db } from "@venore/plugin-sdk";
import { works } from "../../../database/schema";
import { findStoryRecords, findWorkRowById, toWorkRecord } from "../../../database/queries/story-records";
import type { VariableDefinition, WorkRecord } from "../../../contracts/types";

export { findStoryRecords, findWorkRowById as findWorkById };

export async function updateWorkVariablesRow(workId: string, variables: VariableDefinition[]): Promise<WorkRecord> {
  const [row] = await db.update(works).set({ variables, updatedAt: new Date() }).where(eq(works.id, workId)).returning();
  return toWorkRecord(row);
}
