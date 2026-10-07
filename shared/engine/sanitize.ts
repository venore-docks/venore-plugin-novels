import type { Condition, Effect } from "../../contracts/game";
import { CONDITION_OPERATORS, EFFECT_OPERATIONS } from "../../contracts/types";

// Efeitos e condições chegam do editor (client) como JSON: só os campos conhecidos de cada tipo
// passam; tipo desconhecido é descartado. Regras de negócio (item existe, fórmula válida) ficam no
// validador de publicação.

const isObject = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const str = (value: unknown, max = 200): string => (typeof value === "string" ? value.slice(0, max) : typeof value === "number" ? String(value) : "");
const id = (value: unknown): string => str(value, 64);

export function sanitizeEffect(raw: unknown): Effect | null {
  if (!isObject(raw)) return null;
  if (raw.kind === undefined) {
    const variable = str(raw.variable, 40);
    const operation = raw.operation;
    const value = raw.value;
    if (!variable || !EFFECT_OPERATIONS.includes(operation as never)) return null;
    if (typeof value !== "number" && typeof value !== "boolean") return null;
    return { variable, operation: operation as (typeof EFFECT_OPERATIONS)[number], value };
  }
  switch (raw.kind) {
    case "formula":
      return {
        kind: "formula",
        target: str(raw.target, 60),
        operation: raw.operation === "set" ? "set" : "add",
        formula: str(raw.formula, 500),
      };
    case "restore":
      return { kind: "restore", target: str(raw.target, 60) };
    case "item":
      return { kind: "item", operation: raw.operation === "take" ? "take" : "give", itemId: id(raw.itemId), quantity: str(raw.quantity, 200) || "1" };
    case "equip":
      return { kind: "equip", itemId: id(raw.itemId) };
    case "unequip":
      return { kind: "unequip", itemId: id(raw.itemId) };
    case "loot":
      return {
        kind: "loot",
        entries: (Array.isArray(raw.entries) ? raw.entries : [])
          .filter(isObject)
          .slice(0, 20)
          .map((entry) => ({
            itemId: id(entry.itemId),
            chance: Math.max(0, Math.min(100, Number(entry.chance) || 0)),
            quantity: str(entry.quantity, 200) || "1",
          })),
      };
    case "xp":
      return { kind: "xp", amount: str(raw.amount, 200) || "0" };
    case "status":
      return { kind: "status", operation: raw.operation === "remove" ? "remove" : "apply", effectId: id(raw.effectId) };
    case "quest": {
      const operation = ["start", "advance", "complete", "fail"].includes(raw.operation as string) ? (raw.operation as "start") : "start";
      return { kind: "quest", operation, questId: id(raw.questId) };
    }
    case "achievement":
      return { kind: "achievement", achievementId: id(raw.achievementId) };
    default:
      return null;
  }
}

export function sanitizeCondition(raw: unknown): Condition | null {
  if (!isObject(raw)) return null;
  if (raw.kind === undefined) {
    const variable = str(raw.variable, 60);
    const value = raw.value;
    if (!variable || !CONDITION_OPERATORS.includes(raw.operator as never)) return null;
    if (typeof value !== "number" && typeof value !== "boolean") return null;
    return { variable, operator: raw.operator as (typeof CONDITION_OPERATORS)[number], value };
  }
  switch (raw.kind) {
    case "formula":
      return { kind: "formula", formula: str(raw.formula, 500) };
    case "item":
      return { kind: "item", itemId: id(raw.itemId), min: Math.max(1, Math.trunc(Number(raw.min) || 1)) };
    case "equipped":
      return { kind: "equipped", itemId: id(raw.itemId) };
    case "fits":
      return { kind: "fits", itemId: id(raw.itemId) };
    case "quest": {
      const state = ["not_started", "active", "done", "failed"].includes(raw.state as string) ? (raw.state as "active") : "active";
      return { kind: "quest", questId: id(raw.questId), state };
    }
    case "profile":
      return { kind: "profile", field: str(raw.field, 40), value: str(raw.value, 40) };
    case "achievement":
      return { kind: "achievement", achievementId: id(raw.achievementId) };
    case "status":
      return { kind: "status", effectId: id(raw.effectId) };
    default:
      return null;
  }
}

export function sanitizeEffects(raw: unknown, max = 20): Effect[] {
  return (Array.isArray(raw) ? raw : []).map(sanitizeEffect).filter((effect): effect is Effect => effect !== null).slice(0, max);
}

export function sanitizeConditions(raw: unknown, max = 20): Condition[] {
  return (Array.isArray(raw) ? raw : []).map(sanitizeCondition).filter((condition): condition is Condition => condition !== null).slice(0, max);
}
