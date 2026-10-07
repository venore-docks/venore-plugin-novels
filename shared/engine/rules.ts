import type { Condition, Item, Modifier } from "../../contracts/game";
import type { ChoiceCondition, LocalizedText, VariableValue } from "../../contracts/types";
import { withDerivedValues } from "../variables";
import type { GameContext } from "./context";
import { evaluateBoolean, evaluateNumber, num, type FormulaScope, type FormulaValue } from "./formula";
import type { GameState, Stack } from "./types";

// Regras de leitura do estado (sem mudar nada): valores para as fórmulas, modificadores, nível,
// capacidade do inventário e condições. O resto do motor (effects.ts, play.ts) usa estas funções.

export function label(ctx: GameContext, text: LocalizedText | string | undefined): LocalizedText {
  if (typeof text === "string") return { [ctx.locale]: text };
  return text ?? {};
}

// ------------------------------------------------------------------ nível e progressão

export function xpForLevel(ctx: GameContext, level: number): number {
  if (level <= 1) return 0;
  const curve = ctx.system.progression.curve;
  if (curve.kind === "table") {
    const value = curve.thresholds[level - 2];
    return typeof value === "number" ? value : Number.POSITIVE_INFINITY;
  }
  return evaluateNumber(curve.formula, { get: (name) => (name === "n" || name === "nivel" || name === "level" ? level : undefined) }, Number.POSITIVE_INFINITY);
}

export function levelFromXp(ctx: GameContext, xp: number): number {
  const cached = ctx.levelCache.get(xp);
  if (cached !== undefined) return cached;
  let level = 1;
  const max = ctx.system.progression.maxLevel;
  while (level < max && xpForLevel(ctx, level + 1) <= xp) level += 1;
  if (ctx.levelCache.size > 500) ctx.levelCache.clear();
  ctx.levelCache.set(xp, level);
  return level;
}

export function currentLevel(ctx: GameContext, state: GameState): number {
  if (!ctx.on("progression")) return 1;
  return levelFromXp(ctx, num(state.vars[ctx.system.progression.xpKey]));
}

export function pointCost(ctx: GameContext, currentValue: number): number {
  for (const tier of ctx.system.progression.pointCosts) {
    if (tier.upTo === null || currentValue < tier.upTo) return tier.cost;
  }
  return ctx.system.progression.pointCosts.at(-1)?.cost ?? 1;
}

// ------------------------------------------------------------------ modificadores

type ScopeOptions = { skipWeightPenalty?: boolean };

function itemRequirementsMet(ctx: GameContext, state: GameState, item: Item): boolean {
  return item.requirements.every((requirement) => num(baseValue(ctx, state, requirement.key)) >= requirement.min);
}

export function equippedItems(ctx: GameContext, state: GameState): Item[] {
  return Object.values(state.equipped)
    .flat()
    .map((itemId) => ctx.items.get(itemId))
    .filter((item): item is Item => Boolean(item));
}

export function modifiersFor(ctx: GameContext, state: GameState, target: string, options: ScopeOptions = {}): number {
  let total = 0;
  const add = (modifiers: Modifier[]) => {
    for (const modifier of modifiers) if (modifier.target === target) total += modifier.amount;
  };
  if (ctx.on("equipment")) {
    for (const item of equippedItems(ctx, state)) if (itemRequirementsMet(ctx, state, item)) add(item.modifiers);
  }
  if (ctx.on("effects")) {
    for (const active of state.effects) {
      const def = ctx.statusEffects.get(active.id);
      if (def) add(def.modifiers);
    }
  }
  if (!options.skipWeightPenalty && ctx.on("inventory")) {
    const weight = ctx.system.inventory.weight;
    if (weight.enabled && weight.overLimit === "penalty" && currentLoad(ctx, state) > maxLoad(ctx, state)) add(weight.penalty);
  }
  return total;
}

// ------------------------------------------------------------------ valores

function baseValue(ctx: GameContext, state: GameState, key: string): VariableValue | undefined {
  return state.vars[key];
}

export function resourceMax(ctx: GameContext, state: GameState, key: string, options: ScopeOptions = {}): number {
  const resource = ctx.resources.get(key);
  if (!resource) return 0;
  const max = evaluateNumber(resource.max, playerScope(ctx, state, options), 0) + modifiersFor(ctx, state, `${key}.max`, options);
  return Math.max(0, Math.round(max * 100) / 100);
}

export function attributeValue(ctx: GameContext, state: GameState, key: string, options: ScopeOptions = {}): number {
  return num(state.vars[key]) + modifiersFor(ctx, state, key, options);
}

export function attributeCap(ctx: GameContext, state: GameState, key: string): number {
  const attribute = ctx.attributes.get(key);
  let cap = Number.POSITIVE_INFINITY;
  const scope = playerScope(ctx, state);
  if (attribute?.cap.trim()) cap = Math.min(cap, evaluateNumber(attribute.cap, scope, cap));
  if (ctx.on("progression") && ctx.system.progression.attributeCap.trim() && attribute?.kind === "stat") {
    cap = Math.min(cap, evaluateNumber(ctx.system.progression.attributeCap, scope, cap));
  }
  return cap;
}

// Valores que as fórmulas enxergam do personagem. `extra` (combate) vem antes.
export function playerScope(
  ctx: GameContext,
  state: GameState,
  options: ScopeOptions & { extra?: Record<string, FormulaValue>; roll?: (sides: number) => number; onRoll?: FormulaScope["onRoll"] } = {},
): FormulaScope {
  const evaluating = new Set<string>();
  const scope: FormulaScope = {
    roll: options.roll,
    onRoll: options.onRoll,
    get(name) {
      if (options.extra && name in options.extra) return options.extra[name];
      const progression = ctx.system.progression;
      if (ctx.on("progression")) {
        if (name === progression.levelKey) return levelFromXp(ctx, num(state.vars[progression.xpKey]));
        if (name === progression.xpKey || name === progression.pointsKey) return num(state.vars[name]);
      }
      if (name.endsWith(".max")) {
        const key = name.slice(0, -4);
        if (ctx.resources.has(key)) return resourceMax(ctx, state, key, options);
      }
      if (name.endsWith(".base")) {
        const key = name.slice(0, -5);
        if (ctx.attributes.has(key)) return num(state.vars[key]);
      }
      if (ctx.attributes.has(name)) return attributeValue(ctx, state, name, options);
      if (ctx.resources.has(name)) return num(state.vars[name]);
      const derived = ctx.derived.get(name);
      if (derived) {
        if (evaluating.has(name)) return 0;
        evaluating.add(name);
        const value = evaluateNumber(derived.formula, scope, 0) + modifiersFor(ctx, state, name, options);
        evaluating.delete(name);
        return value;
      }
      if (ctx.variables.has(name)) {
        const value = state.vars[name];
        return value === undefined ? ctx.variables.get(name)!.initial : value;
      }
      if (ctx.on("shops") && ctx.system.currency.mode === "counter" && name === ctx.system.currency.key) return num(state.vars[name]);
      if (name === "_carga" || name === "_espaco_livre") {
        return num(withDerivedValues(state.vars, [...ctx.variables.values()])[name]);
      }
      return undefined;
    },
    call(name, args) {
      const key = String(args[0] ?? "");
      switch (name) {
        case "tem":
        case "has": {
          const item = ctx.itemsByKey.get(key);
          return item ? itemCount(ctx, state, item.id) : 0;
        }
        case "equipado":
        case "equipped": {
          const item = ctx.itemsByKey.get(key);
          return item ? Object.values(state.equipped).some((ids) => ids.includes(item.id)) : false;
        }
        case "cabe":
        case "fits": {
          const item = ctx.itemsByKey.get(key);
          return item ? fits(ctx, state, item.id, Math.max(1, num(args[1] ?? 1))) : false;
        }
        case "perfil":
        case "profile":
          return state.profile[key] ?? "";
        case "missao":
        case "quest": {
          const quest = state.quests[key];
          return quest ? quest.state : "nao_iniciada";
        }
        case "etapa":
          return state.quests[key]?.step ?? 0;
        case "conquista":
          return state.achievements.includes(key);
        case "efeito":
          return state.effects.some((effect) => effect.id === key);
        default:
          return undefined;
      }
    },
  };
  return scope;
}

// Nomes que as fórmulas da obra podem usar (validador e autocompletar).
export function knownFormulaNames(ctx: Pick<GameContext, "system" | "variables" | "on">): Set<string> {
  const names = new Set<string>();
  const system = ctx.system;
  for (const key of ctx.variables.keys()) names.add(key);
  if (ctx.on("resources")) for (const resource of system.resources) names.add(resource.key).add(`${resource.key}.max`);
  if (ctx.on("attributes")) {
    for (const attribute of system.attributes) names.add(attribute.key).add(`${attribute.key}.base`);
    for (const derived of system.derived) names.add(derived.key);
  }
  if (ctx.on("progression")) names.add(system.progression.xpKey).add(system.progression.levelKey).add(system.progression.pointsKey);
  if (ctx.on("shops") && system.currency.mode === "counter") names.add(system.currency.key);
  names.add("_carga").add("_espaco_livre");
  return names;
}

export const CONTEXT_FUNCTIONS = new Set(["tem", "has", "equipado", "equipped", "cabe", "fits", "perfil", "profile", "missao", "quest", "etapa", "conquista", "efeito"]);

// ------------------------------------------------------------------ inventário

export function itemCount(ctx: GameContext, state: GameState, itemId: string): number {
  const inBag = state.bag.filter((stack) => stack.itemId === itemId).reduce((sum, stack) => sum + stack.quantity, 0);
  const equipped = Object.values(state.equipped).flat().filter((id) => id === itemId).length;
  return inBag + equipped;
}

export function stackSpace(item: Item, quantity: number): number {
  if (quantity <= 0) return 0;
  if (item.stackable) return Math.ceil(quantity / Math.max(1, item.maxStack)) * Math.max(1, item.size);
  return quantity * Math.max(1, item.size);
}

export function spaceUsed(ctx: GameContext, state: GameState, bag: Stack[] = state.bag): number {
  return bag.reduce((sum, stack) => {
    const item = ctx.items.get(stack.itemId);
    return sum + (item ? stackSpace(item, stack.quantity) : 0);
  }, 0);
}

export function spaceTotal(ctx: GameContext, state: GameState): number {
  const base = ctx.system.inventory.space.base;
  const containers = ctx.on("equipment")
    ? equippedItems(ctx, state).reduce((sum, item) => sum + (item.type === "container" ? item.containerSlots : 0), 0)
    : 0;
  return base + containers;
}

export function currentLoad(ctx: GameContext, state: GameState, bag: Stack[] = state.bag): number {
  let total = bag.reduce((sum, stack) => sum + (ctx.items.get(stack.itemId)?.weight ?? 0) * stack.quantity, 0);
  if (ctx.system.inventory.weight.countEquipped) total += equippedItems(ctx, state).reduce((sum, item) => sum + item.weight, 0);
  return Math.round(total * 100) / 100;
}

export function maxLoad(ctx: GameContext, state: GameState): number {
  return evaluateNumber(ctx.system.inventory.weight.max, playerScope(ctx, state, { skipWeightPenalty: true }), Number.POSITIVE_INFINITY);
}

export function mergeStack(bag: Stack[], itemId: string, quantity: number): Stack[] {
  const existing = bag.find((stack) => stack.itemId === itemId);
  if (existing) return bag.map((stack) => (stack.itemId === itemId ? { ...stack, quantity: stack.quantity + quantity } : stack));
  return [...bag, { itemId, quantity }];
}

// Cabe na mochila (espaço) e no peso (quando o excesso bloqueia)?
export function fits(ctx: GameContext, state: GameState, itemId: string, quantity: number): boolean {
  if (!ctx.on("inventory")) return true;
  const item = ctx.items.get(itemId);
  if (!item) return false;
  const bag = mergeStack(state.bag, itemId, quantity);
  const inventory = ctx.system.inventory;
  if (inventory.space.enabled && spaceUsed(ctx, state, bag) > spaceTotal(ctx, state)) return false;
  if (inventory.weight.enabled && inventory.weight.overLimit === "block" && currentLoad(ctx, state, bag) > maxLoad(ctx, state)) return false;
  return true;
}

// ------------------------------------------------------------------ condições

function legacyCondition(condition: ChoiceCondition, values: Record<string, VariableValue>): boolean {
  const current = values[condition.variable];
  if (current === undefined) return false;
  const a = current;
  const b = condition.value;
  switch (condition.operator) {
    case "eq":
      return a === b;
    case "neq":
      return a !== b;
    case "gt":
      return typeof a === "number" && typeof b === "number" && a > b;
    case "gte":
      return typeof a === "number" && typeof b === "number" && a >= b;
    case "lt":
      return typeof a === "number" && typeof b === "number" && a < b;
    case "lte":
      return typeof a === "number" && typeof b === "number" && a <= b;
  }
}

export function evaluateCondition(ctx: GameContext, state: GameState, condition: Condition): boolean {
  if (!("kind" in condition) || condition.kind === undefined) {
    const legacy = condition as ChoiceCondition;
    // Condição antiga também enxerga recursos e atributos pela chave.
    const scope = playerScope(ctx, state);
    const value = scope.get(legacy.variable);
    const values: Record<string, VariableValue> = { ...withDerivedValues(state.vars, [...ctx.variables.values()]) };
    if (value !== undefined && typeof value !== "string") values[legacy.variable] = value;
    return legacyCondition(legacy, values);
  }
  switch (condition.kind) {
    case "formula":
      return evaluateBoolean(condition.formula, playerScope(ctx, state));
    case "item":
      return itemCount(ctx, state, condition.itemId) >= Math.max(1, condition.min);
    case "equipped":
      return Object.values(state.equipped).some((ids) => ids.includes(condition.itemId));
    case "fits":
      return fits(ctx, state, condition.itemId, 1);
    case "quest": {
      const quest = state.quests[condition.questId];
      return condition.state === "not_started" ? !quest : quest?.state === condition.state;
    }
    case "profile":
      return (state.profile[condition.field] ?? "") === condition.value;
    case "achievement":
      return state.achievements.includes(condition.achievementId);
    case "status":
      return state.effects.some((effect) => effect.id === condition.effectId);
  }
}

export function conditionsMet(ctx: GameContext, state: GameState, conditions: Condition[]): boolean {
  return conditions.every((condition) => evaluateCondition(ctx, state, condition));
}
