import { asc, eq } from "drizzle-orm";
import { db } from "@venore/plugin-sdk";
import type { SystemTemplatePackage, SystemTemplateRecord } from "../../../contracts/game";
import { creatures, items, systemTemplates, works } from "../../../database/schema";
import { findStoryRecords, findWorkRowById } from "../../../database/queries/story-records";
import { parsePackage, type ApplyPlan } from "../../../shared/templates/package";

export { findStoryRecords, findWorkRowById as findWorkById };

function toRecord(row: typeof systemTemplates.$inferSelect): SystemTemplateRecord | null {
  // Pacote salvo por uma versão antiga do plugin passa pelo mesmo leitor da importação.
  const parsed = parsePackage(row.package);
  if (!parsed.ok) return null;
  return { id: row.id, key: row.key, name: row.name, description: row.description, package: parsed.value, builtIn: false, updatedAt: row.updatedAt };
}

export async function findTemplates(): Promise<SystemTemplateRecord[]> {
  const rows = await db.select().from(systemTemplates).orderBy(asc(systemTemplates.createdAt));
  return rows.map(toRecord).filter((record): record is SystemTemplateRecord => record !== null);
}

export async function findTemplateByKey(key: string): Promise<SystemTemplatePackage | null> {
  const [row] = await db.select().from(systemTemplates).where(eq(systemTemplates.key, key)).limit(1);
  return row ? (toRecord(row)?.package ?? null) : null;
}

export async function upsertTemplate(pkg: SystemTemplatePackage): Promise<string> {
  const [row] = await db
    .insert(systemTemplates)
    .values({ key: pkg.key, name: pkg.name, description: pkg.description, package: pkg })
    .onConflictDoUpdate({ target: systemTemplates.key, set: { name: pkg.name, description: pkg.description, package: pkg, updatedAt: new Date() } })
    .returning({ id: systemTemplates.id });
  return row.id;
}

export async function deleteTemplate(id: string): Promise<boolean> {
  const rows = await db.delete(systemTemplates).where(eq(systemTemplates.id, id)).returning({ id: systemTemplates.id });
  return rows.length > 0;
}

export async function applyPlan(workId: string, plan: ApplyPlan): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.update(works).set({ gameSystem: plan.system, variables: plan.variables, updatedAt: new Date() }).where(eq(works.id, workId));
    for (const entry of plan.items) {
      if (entry.isNew) await tx.insert(items).values({ id: entry.id, workId, ...entry.fields });
      else await tx.update(items).set({ ...entry.fields, updatedAt: new Date() }).where(eq(items.id, entry.id));
    }
    for (const entry of plan.creatures) {
      if (entry.isNew) await tx.insert(creatures).values({ id: entry.id, workId, ...entry.fields });
      else await tx.update(creatures).set({ ...entry.fields, updatedAt: new Date() }).where(eq(creatures.id, entry.id));
    }
  });
}
