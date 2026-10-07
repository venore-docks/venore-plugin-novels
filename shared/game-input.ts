import { ITEM_RARITIES, ITEM_TYPES, type Creature, type Item, type LootEntry, type Modifier } from "../contracts/game";
import type { LocalizedText } from "../contracts/types";
import { sanitizeEffects } from "./engine/sanitize";

// Itens e criaturas chegam do editor (client) ou de um pacote de modelo importado: só os campos
// conhecidos passam, com limites. Regras que dependem da obra (área existe, item da tabela de saque
// existe) ficam no validador de publicação.

export const GAME_LIMITS = { items: 300, creatures: 150, modifiers: 12, effects: 12, loot: 20, stats: 30, requirements: 8 };

const KEY_PATTERN = /^[a-z][a-z0-9_]{0,39}$/;
const isObject = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const int = (value: unknown, min: number, max: number, fallback: number) => {
  const number = Math.trunc(Number(value));
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
};
const real = (value: unknown, min: number, max: number, fallback: number) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, Math.round(number * 100) / 100)) : fallback;
};
const str = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "");

function text(value: unknown, max: number): LocalizedText {
  if (!isObject(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .filter((entry): entry is [string, string] => typeof entry[1] === "string" && /^[a-z]{2}(-[A-Z]{2})?$/.test(entry[0]))
      .map(([locale, content]) => [locale, content.trim().slice(0, max)])
      .filter(([, content]) => content),
  );
}

export function isGameKey(value: string): boolean {
  return KEY_PATTERN.test(value);
}

export function toGameKey(value: string): string {
  const key = value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^[^a-z]+/, "")
    .replace(/_+$/, "")
    .slice(0, 40);
  return key || "item";
}

function modifiers(value: unknown): Modifier[] {
  return (Array.isArray(value) ? value : [])
    .filter(isObject)
    .map((modifier) => ({ target: str(modifier.target, 60), amount: real(modifier.amount, -100000, 100000, 0) }))
    .filter((modifier) => modifier.target && modifier.amount !== 0)
    .slice(0, GAME_LIMITS.modifiers);
}

export function sanitizeLoot(value: unknown): LootEntry[] {
  return (Array.isArray(value) ? value : [])
    .filter(isObject)
    .map((entry) => ({ itemId: str(entry.itemId, 64), chance: real(entry.chance, 0, 100, 100), quantity: str(entry.quantity, 200) || "1" }))
    .filter((entry) => entry.itemId)
    .slice(0, GAME_LIMITS.loot);
}

export type ItemFields = Omit<Item, "id" | "position">;

export function sanitizeItemFields(raw: unknown): ItemFields {
  const value = isObject(raw) ? raw : {};
  const type = ITEM_TYPES.includes(value.type as Item["type"]) ? (value.type as Item["type"]) : "material";
  const stackable = value.stackable === true;
  return {
    key: str(value.key, 40),
    name: text(value.name, 80),
    description: text(value.description, 600),
    imageMediaId: str(value.imageMediaId, 64) || null,
    type,
    slot: str(value.slot, 40) || null,
    hands: int(value.hands, 0, 4, 0),
    size: int(value.size, 0, 4, 1),
    weight: real(value.weight, 0, 100000, 0),
    stackable,
    maxStack: stackable ? int(value.maxStack, 1, 10000, 100) : 1,
    modifiers: modifiers(value.modifiers),
    useEffects: sanitizeEffects(value.useEffects, GAME_LIMITS.effects),
    consumable: value.consumable === true,
    requirements: (Array.isArray(value.requirements) ? value.requirements : [])
      .filter(isObject)
      .map((requirement) => ({ key: str(requirement.key, 40), min: real(requirement.min, -100000, 100000, 0) }))
      .filter((requirement) => requirement.key)
      .slice(0, GAME_LIMITS.requirements),
    containerSlots: type === "container" ? int(value.containerSlots, 0, 60, 0) : 0,
    value: int(value.value, 0, 10_000_000, 0),
    rarity: ITEM_RARITIES.includes(value.rarity as Item["rarity"]) ? (value.rarity as Item["rarity"]) : "common",
    droppable: value.droppable !== false,
  };
}

export type CreatureFields = Omit<Creature, "id" | "position">;

export function sanitizeCreatureFields(raw: unknown): CreatureFields {
  const value = isObject(raw) ? raw : {};
  const stats = isObject(value.stats) ? value.stats : {};
  return {
    key: str(value.key, 40),
    name: text(value.name, 80),
    description: text(value.description, 600),
    imageMediaId: str(value.imageMediaId, 64) || null,
    stats: Object.fromEntries(
      Object.entries(stats)
        .filter(([key]) => KEY_PATTERN.test(key))
        .map(([key, amount]) => [key, real(amount, -1_000_000, 1_000_000, 0)] as const)
        .slice(0, GAME_LIMITS.stats),
    ),
    hp: int(value.hp, 1, 10_000_000, 10),
    behavior: (["attack", "flee_low", "heal_once"] as const).includes(value.behavior as Creature["behavior"]) ? (value.behavior as Creature["behavior"]) : "attack",
    xp: int(value.xp, 0, 100_000_000, 0),
    loot: sanitizeLoot(value.loot),
  };
}

// Problema de cadastro que impede salvar (o resto é aviso no validador da obra).
export function itemFieldsError(fields: ItemFields, defaultLocale: string): string | null {
  if (!isGameKey(fields.key)) return "Chave do item: use letras minúsculas, números e _ (começando por letra).";
  if (!fields.name[defaultLocale]) return "Dê um nome ao item no idioma principal da obra.";
  return null;
}

export function creatureFieldsError(fields: CreatureFields, defaultLocale: string): string | null {
  if (!isGameKey(fields.key)) return "Chave da criatura: use letras minúsculas, números e _ (começando por letra).";
  if (!fields.name[defaultLocale]) return "Dê um nome à criatura no idioma principal da obra.";
  return null;
}
