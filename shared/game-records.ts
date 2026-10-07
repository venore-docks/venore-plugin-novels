import { ITEM_RARITIES, ITEM_TYPES, type CreatureRecord, type ItemRecord } from "../contracts/game";
import type { creatures, items } from "../database/schema";

// Linha do banco -> registro (valores fora da lista voltam ao padrão).
export function toItemRecord(row: typeof items.$inferSelect): ItemRecord {
  return {
    id: row.id,
    workId: row.workId,
    key: row.key,
    name: row.name,
    description: row.description,
    imageMediaId: row.imageMediaId,
    type: ITEM_TYPES.includes(row.type as ItemRecord["type"]) ? (row.type as ItemRecord["type"]) : "material",
    slot: row.slot,
    hands: row.hands,
    size: row.size,
    weight: row.weight,
    stackable: row.stackable,
    maxStack: row.maxStack,
    modifiers: row.modifiers,
    useEffects: row.useEffects,
    consumable: row.consumable,
    requirements: row.requirements,
    containerSlots: row.containerSlots,
    value: row.value,
    rarity: ITEM_RARITIES.includes(row.rarity as ItemRecord["rarity"]) ? (row.rarity as ItemRecord["rarity"]) : "common",
    droppable: row.droppable,
    position: row.position,
  };
}

export function toCreatureRecord(row: typeof creatures.$inferSelect): CreatureRecord {
  return {
    id: row.id,
    workId: row.workId,
    key: row.key,
    name: row.name,
    description: row.description,
    imageMediaId: row.imageMediaId,
    stats: row.stats,
    hp: row.hp,
    behavior: (["attack", "flee_low", "heal_once"] as const).includes(row.behavior as CreatureRecord["behavior"])
      ? (row.behavior as CreatureRecord["behavior"])
      : "attack",
    xp: row.xp,
    loot: row.loot,
    position: row.position,
  };
}

export function withoutWork<T extends { workId: string }>(record: T): Omit<T, "workId"> {
  const { workId: _ignored, ...rest } = record;
  void _ignored;
  return rest;
}
