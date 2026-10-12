import type {
  AchievementDef,
  Creature,
  EquipmentSlotDef,
  Item,
  ProfileFieldDef,
  QuestDef,
  StatusEffectDef,
  VocationDef,
} from "../../contracts/game";
import type { AccentColor, LocalizedText } from "../../contracts/types";
import { characterSheet, hasCharacterSheet, type CharacterSheet } from "../variables";
import type { GameContext } from "./context";
import { HANDS_SLOT } from "./effects";
import { evaluateNumber, num } from "./formula";
import {
  attributeCap,
  attributeValue,
  currentLevel,
  currentLoad,
  maxLoad,
  playerScope,
  pointCost,
  resourceMax,
  spaceTotal,
  spaceUsed,
  stackSpace,
  xpForLevel,
} from "./rules";
import { canAllocate, currency } from "./play";
import type { GameState, Stack } from "./types";

// Ficha do personagem para o leitor (HUD e painel): tudo já calculado a partir do estado.

export type SheetResource = {
  key: string;
  name: LocalizedText;
  abbr: LocalizedText;
  color: AccentColor;
  value: number;
  max: number;
  low: boolean;
  showInHud: boolean;
};

export type SheetAttribute = {
  key: string;
  name: LocalizedText;
  abbr: LocalizedText;
  kind: "stat" | "skill";
  base: number;
  value: number;
  modifier: number;
  cap: number | null;
  canRaise: boolean;
  cost: number;
  training: { progress: number; threshold: number } | null;
  showInHud: boolean;
};

export type SheetItem = { stack: Stack; item: Item; space: number; weight: number };

export type SheetSlot = { key: string; name: LocalizedText; capacity: number; items: Item[] };

export type CharacterSheetV2 = {
  resources: SheetResource[];
  stats: SheetAttribute[];
  skills: SheetAttribute[];
  derived: { key: string; name: LocalizedText; value: number }[];
  legacy: CharacterSheet | null;
  level: {
    value: number;
    name: LocalizedText;
    xp: number;
    xpName: LocalizedText;
    from: number;
    to: number | null;
    points: number;
    pointsName: LocalizedText;
  } | null;
  inventory: {
    bag: SheetItem[];
    overflow: SheetItem[];
    ground: SheetItem[];
    weight: { name: LocalizedText; unit: LocalizedText; value: number; max: number } | null;
    space: { name: LocalizedText; used: number; total: number } | null;
  } | null;
  equipment: { slots: SheetSlot[]; hands: { name: LocalizedText; capacity: number; items: Item[] } | null } | null;
  effects: { def: StatusEffectDef; remaining: number | null }[];
  quests: { def: QuestDef; state: "active" | "done" | "failed"; step: number }[];
  achievements: { def: AchievementDef; unlocked: boolean }[];
  profile: { field: ProfileFieldDef; value: string; label: LocalizedText | null }[];
  vocation: VocationDef | null;
  currency: { name: LocalizedText; value: number } | null;
  bestiary: Creature[];
  // Há algo para mostrar no HUD (rodapé) e no painel (diálogo).
  hasHud: boolean;
  hasPanel: boolean;
};

function sheetItems(ctx: GameContext, stacks: Stack[]): SheetItem[] {
  return stacks
    .map((stack) => {
      const item = ctx.items.get(stack.itemId);
      return item ? { stack, item, space: stackSpace(item, stack.quantity), weight: Math.round(item.weight * stack.quantity * 100) / 100 } : null;
    })
    .filter((entry): entry is SheetItem => Boolean(entry));
}

export function buildSheet(ctx: GameContext, state: GameState): CharacterSheetV2 {
  const system = ctx.system;
  const resources: SheetResource[] = [...ctx.resources.values()].map((resource) => {
    const value = num(state.vars[resource.key]);
    const max = resourceMax(ctx, state, resource.key);
    return {
      key: resource.key,
      name: resource.name,
      abbr: resource.abbr,
      color: resource.color,
      value,
      max,
      low: max > 0 && (value / max) * 100 <= resource.lowPercent,
      showInHud: resource.showInHud,
    };
  });
  const attributes: SheetAttribute[] = [...ctx.attributes.values()].map((attribute) => {
    const base = num(state.vars[attribute.key]);
    const value = attributeValue(ctx, state, attribute.key);
    const cap = attributeCap(ctx, state, attribute.key);
    const threshold = attribute.training.enabled
      ? evaluateNumber(attribute.training.threshold, { get: (name) => (name === "valor" || name === "value" ? base : undefined) }, 0)
      : 0;
    return {
      key: attribute.key,
      name: attribute.name,
      abbr: attribute.abbr,
      kind: attribute.kind,
      base,
      value,
      modifier: Math.round((value - base) * 100) / 100,
      cap: Number.isFinite(cap) ? cap : null,
      canRaise: attribute.kind === "stat" && canAllocate(ctx, state, attribute.key),
      cost: pointCost(ctx, base),
      training: attribute.training.enabled && threshold > 0 ? { progress: state.training[attribute.key] ?? 0, threshold } : null,
      showInHud: attribute.showInHud,
    };
  });
  const scope = playerScope(ctx, state);
  const derived = system.derived
    .filter((entry) => ctx.on("attributes") && entry.show)
    .map((entry) => ({ key: entry.key, name: entry.name, value: Math.round(num(scope.get(entry.key)) * 100) / 100 }));

  let level: CharacterSheetV2["level"] = null;
  if (ctx.on("progression")) {
    const value = currentLevel(ctx, state);
    const to = value < system.progression.maxLevel ? xpForLevel(ctx, value + 1) : null;
    level = {
      value,
      name: system.progression.levelName,
      xp: num(state.vars[system.progression.xpKey]),
      xpName: system.progression.xpName,
      from: xpForLevel(ctx, value),
      to: to !== null && Number.isFinite(to) ? to : null,
      points: num(state.vars[system.progression.pointsKey]),
      pointsName: system.progression.pointsName,
    };
  }

  const inventoryOn = ctx.on("inventory") && ctx.items.size > 0;
  const inventory: CharacterSheetV2["inventory"] = inventoryOn
    ? {
        bag: sheetItems(ctx, state.bag),
        overflow: sheetItems(ctx, state.overflow),
        ground: sheetItems(ctx, state.ground),
        weight: system.inventory.weight.enabled
          ? { name: system.inventory.weight.name, unit: system.inventory.weight.unit, value: currentLoad(ctx, state), max: maxLoad(ctx, state) }
          : null,
        space: system.inventory.space.enabled ? { name: system.inventory.space.name, used: spaceUsed(ctx, state), total: spaceTotal(ctx, state) } : null,
      }
    : null;

  const itemById = (id: string) => ctx.items.get(id);
  const equipment: CharacterSheetV2["equipment"] = ctx.on("equipment")
    ? {
        slots: system.slots.map((slot: EquipmentSlotDef) => ({
          key: slot.key,
          name: slot.name,
          capacity: slot.count,
          items: (state.equipped[slot.key] ?? []).map(itemById).filter((item): item is Item => Boolean(item)),
        })),
        hands: system.inventory.hands.enabled
          ? {
              name: system.inventory.hands.name,
              capacity: system.inventory.hands.count,
              items: (state.equipped[HANDS_SLOT] ?? []).map(itemById).filter((item): item is Item => Boolean(item)),
            }
          : null,
      }
    : null;

  const effects = state.effects
    .map((active) => ({ def: ctx.statusEffects.get(active.id), remaining: active.remaining }))
    .filter((entry): entry is { def: StatusEffectDef; remaining: number | null } => Boolean(entry.def));
  const quests = Object.entries(state.quests)
    .map(([id, quest]) => ({ def: ctx.quests.get(id), ...quest }))
    .filter((entry): entry is { def: QuestDef; state: "active" | "done" | "failed"; step: number } => Boolean(entry.def));
  const achievements = [...ctx.achievements.values()]
    .map((def) => ({ def, unlocked: state.achievements.includes(def.id) }))
    .filter((entry) => entry.unlocked || !entry.def.hidden);
  const profile = ctx.on("character")
    ? system.character.fields.map((field) => {
        const value = state.profile[field.key] ?? field.fallback;
        return { field, value, label: field.kind === "choice" ? (field.options.find((option) => option.value === value)?.name ?? null) : null };
      })
    : [];
  const vocation = system.character.vocations.find((candidate) => candidate.id === state.vocationId) ?? null;
  const legacy = hasCharacterSheet(ctx.story.work.variables) ? characterSheet(state.vars, ctx.story.work.variables) : null;
  const bestiary = ctx.on("bestiary")
    ? state.seenCreatures.map((id) => ctx.creatures.get(id)).filter((creature): creature is Creature => Boolean(creature))
    : [];

  const hasHud = resources.some((resource) => resource.showInHud) || attributes.some((attribute) => attribute.showInHud) || Boolean(level) || Boolean(legacy?.status.length);
  const hasPanel =
    attributes.length > 0 ||
    derived.length > 0 ||
    Boolean(inventory) ||
    Boolean(equipment) ||
    effects.length > 0 ||
    quests.length > 0 ||
    achievements.length > 0 ||
    profile.length > 0 ||
    bestiary.length > 0 ||
    Boolean(legacy && (legacy.skills.length > 0 || legacy.hasInventory));

  return {
    resources,
    stats: attributes.filter((attribute) => attribute.kind === "stat"),
    skills: attributes.filter((attribute) => attribute.kind === "skill"),
    derived,
    legacy,
    level,
    inventory,
    equipment,
    effects,
    quests,
    achievements,
    profile,
    vocation,
    currency: ctx.on("shops") ? { name: system.currency.name, value: currency(ctx, state) } : null,
    bestiary,
    hasHud,
    hasPanel,
  };
}
