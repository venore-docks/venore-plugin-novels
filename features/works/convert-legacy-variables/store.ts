import { eq } from "drizzle-orm";
import { db } from "@venore/plugin-sdk";
import type { Condition, Effect, GameSystem, Item } from "../../../contracts/game";
import type { VariableDefinition } from "../../../contracts/types";
import { choices as choicesTable, items, scenes as scenesTable, works } from "../../../database/schema";

export { findStoryRecords, findWorkRowById as findWorkById } from "../../../database/queries/story-records";

export async function applyConversion(
  workId: string,
  change: {
    variables: VariableDefinition[];
    system: GameSystem;
    items: { id: string; fields: Omit<Item, "id"> }[];
    scenes: Map<string, Effect[]>;
    choices: { id: string; conditions: Condition[]; effects: Effect[] }[];
  },
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.update(works).set({ variables: change.variables, gameSystem: change.system, updatedAt: new Date() }).where(eq(works.id, workId));
    for (const entry of change.items) await tx.insert(items).values({ id: entry.id, workId, ...entry.fields });
    for (const [sceneId, effects] of change.scenes) await tx.update(scenesTable).set({ effects }).where(eq(scenesTable.id, sceneId));
    for (const choice of change.choices) await tx.update(choicesTable).set({ conditions: choice.conditions, effects: choice.effects }).where(eq(choicesTable.id, choice.id));
  });
}
