import type { Effect } from "../../contracts/game";
import type { VariableEffect } from "../../contracts/types";
import { clampAll as clampLegacy, clampNumber } from "../variables";
import type { GameContext } from "./context";
import { evaluateNumber, num, type DiceRoll } from "./formula";
import { dieAt } from "./rng";
import { currentLevel, fits, mergeStack, playerScope, resourceMax } from "./rules";
import type { GameState, Stack } from "./types";

// Mudanças no estado: efeitos de cena/escolha/item, inventário e gatilhos de recurso. Trabalha
// sobre uma cópia (`draft`) que o chamador já clonou.

export function cloneState(state: GameState): GameState {
  return {
    ...state,
    path: [...state.path],
    entries: state.entries.map((entry) => ({ ...entry, changes: [...entry.changes], rolls: [...entry.rolls], combat: [...entry.combat] })),
    vars: { ...state.vars },
    visitedEndings: [...state.visitedEndings],
    achievements: [...state.achievements],
    bag: state.bag.map((stack) => ({ ...stack })),
    equipped: Object.fromEntries(Object.entries(state.equipped).map(([slot, ids]) => [slot, [...ids]])),
    overflow: state.overflow.map((stack) => ({ ...stack })),
    ground: state.ground.map((stack) => ({ ...stack })),
    effects: state.effects.map((effect) => ({ ...effect })),
    quests: Object.fromEntries(Object.entries(state.quests).map(([id, quest]) => [id, { ...quest }])),
    training: { ...state.training },
    triggers: { ...state.triggers },
    profile: { ...state.profile },
    combat: state.combat
      ? { ...state.combat, creatures: state.combat.creatures.map((creature) => ({ ...creature })) }
      : null,
    shopStock: Object.fromEntries(Object.entries(state.shopStock).map(([scene, stock]) => [scene, { ...stock }])),
    seenCreatures: [...state.seenCreatures],
    log: [...state.log],
  };
}

// Rolagem determinística: semente da partida + contador (que só anda para frente).
export function roller(draft: GameState) {
  return (sides: number) => dieAt(draft.seed, draft.counter++, sides);
}

export function scopeFor(ctx: GameContext, draft: GameState, onRoll?: (roll: DiceRoll) => void) {
  return playerScope(ctx, draft, { roll: roller(draft), onRoll });
}

// ------------------------------------------------------------------ limites

export function clampState(ctx: GameContext, draft: GameState): void {
  draft.vars = clampLegacy(draft.vars, [...ctx.variables.values()]);
  for (const resource of ctx.resources.values()) {
    const max = resourceMax(ctx, draft, resource.key);
    draft.vars[resource.key] = Math.max(0, Math.min(num(draft.vars[resource.key]), max));
  }
  for (const attribute of ctx.attributes.values()) {
    draft.vars[attribute.key] = Math.max(attribute.min, num(draft.vars[attribute.key]));
  }
}

// ------------------------------------------------------------------ inventário

export function addItem(ctx: GameContext, draft: GameState, itemId: string, quantity: number): void {
  const item = ctx.items.get(itemId);
  if (!item || quantity <= 0) return;
  // Moeda do tipo contador não ocupa a mochila.
  if (fits(ctx, draft, itemId, quantity)) {
    draft.bag = mergeStack(draft.bag, itemId, quantity);
    return;
  }
  // Não coube: o que der entra e o resto fica "sobrando" até o leitor resolver.
  let stored = 0;
  while (stored < quantity && fits(ctx, draft, itemId, 1)) {
    draft.bag = mergeStack(draft.bag, itemId, 1);
    stored += 1;
  }
  draft.overflow = mergeStack(draft.overflow, itemId, quantity - stored);
}

function takeFrom(stacks: Stack[], itemId: string, quantity: number): { stacks: Stack[]; taken: number } {
  let remaining = quantity;
  const next: Stack[] = [];
  for (const stack of stacks) {
    if (stack.itemId !== itemId || remaining <= 0) {
      next.push(stack);
      continue;
    }
    const take = Math.min(stack.quantity, remaining);
    remaining -= take;
    if (stack.quantity - take > 0) next.push({ ...stack, quantity: stack.quantity - take });
  }
  return { stacks: next, taken: quantity - remaining };
}

export function removeItem(ctx: GameContext, draft: GameState, itemId: string, quantity: number): number {
  const fromBag = takeFrom(draft.bag, itemId, quantity);
  draft.bag = fromBag.stacks;
  let taken = fromBag.taken;
  // Tirar item também tira do equipado (o carcereiro leva a espada da mão).
  for (const slot of Object.keys(draft.equipped)) {
    while (taken < quantity && draft.equipped[slot].includes(itemId)) {
      draft.equipped[slot].splice(draft.equipped[slot].indexOf(itemId), 1);
      taken += 1;
    }
  }
  if (taken < quantity) {
    const fromOverflow = takeFrom(draft.overflow, itemId, quantity - taken);
    draft.overflow = fromOverflow.stacks;
    taken += fromOverflow.taken;
  }
  return taken;
}

// O que estava sobrando entra na mochila assim que couber.
export function storeOverflow(ctx: GameContext, draft: GameState): void {
  const pending = draft.overflow;
  draft.overflow = [];
  for (const stack of pending) addItem(ctx, draft, stack.itemId, stack.quantity);
}

export const HANDS_SLOT = "__hands";

// Onde o item vai: a área dele, ou as mãos (armas e escudos).
export function slotForItem(ctx: GameContext, itemId: string): { key: string; capacity: number; uses: number } | null {
  const item = ctx.items.get(itemId);
  if (!item) return null;
  if (item.slot) {
    const slot = ctx.system.slots.find((candidate) => candidate.key === item.slot);
    return slot ? { key: slot.key, capacity: slot.count, uses: 1 } : null;
  }
  if (item.hands > 0 && ctx.system.inventory.hands.enabled) {
    return { key: HANDS_SLOT, capacity: ctx.system.inventory.hands.count, uses: Math.min(item.hands, ctx.system.inventory.hands.count) };
  }
  return null;
}

function slotUsage(ctx: GameContext, draft: GameState, slotKey: string): number {
  return (draft.equipped[slotKey] ?? []).reduce((sum, id) => {
    const item = ctx.items.get(id);
    return sum + (slotKey === HANDS_SLOT ? Math.max(1, item?.hands ?? 1) : 1);
  }, 0);
}

export function equipItem(ctx: GameContext, draft: GameState, itemId: string, fromBag: boolean): string | null {
  const item = ctx.items.get(itemId);
  const slot = slotForItem(ctx, itemId);
  if (!item || !slot) return "Esse item não se equipa.";
  if (fromBag) {
    const { stacks, taken } = takeFrom(draft.bag, itemId, 1);
    if (taken === 0) return "O item não está na mochila.";
    draft.bag = stacks;
  }
  const list = (draft.equipped[slot.key] ??= []);
  // Área cheia: o que estava há mais tempo volta para a mochila.
  while (list.length > 0 && slotUsage(ctx, draft, slot.key) + slot.uses > slot.capacity) {
    const removed = list.shift()!;
    addItem(ctx, draft, removed, 1);
  }
  list.push(itemId);
  return null;
}

export function unequipItem(ctx: GameContext, draft: GameState, itemId: string): string | null {
  for (const slot of Object.keys(draft.equipped)) {
    const index = draft.equipped[slot].indexOf(itemId);
    if (index >= 0) {
      draft.equipped[slot].splice(index, 1);
      addItem(ctx, draft, itemId, 1);
      return null;
    }
  }
  return "O item não está equipado.";
}

// ------------------------------------------------------------------ efeitos

function applyLegacy(ctx: GameContext, draft: GameState, effect: VariableEffect): void {
  const definition = ctx.variables.get(effect.variable);
  if (!definition) {
    // Formato antigo apontando para um recurso/atributo: soma ou define número.
    if ((ctx.resources.has(effect.variable) || ctx.attributes.has(effect.variable)) && typeof effect.value === "number") {
      const current = num(draft.vars[effect.variable]);
      draft.vars[effect.variable] = effect.operation === "add" ? current + effect.value : effect.value;
    }
    return;
  }
  const current = draft.vars[effect.variable] ?? definition.initial;
  if (effect.operation === "set" && typeof effect.value === typeof definition.initial) draft.vars[effect.variable] = effect.value;
  else if (effect.operation === "add" && typeof current === "number" && typeof effect.value === "number") draft.vars[effect.variable] = current + effect.value;
  else if (effect.operation === "toggle" && typeof current === "boolean") draft.vars[effect.variable] = !current;
  const value = draft.vars[effect.variable];
  if (typeof value === "number") draft.vars[effect.variable] = clampNumber(definition, value, draft.vars);
}

export function applyEffect(ctx: GameContext, draft: GameState, effect: Effect, depth = 0): void {
  if (depth > 4) return;
  if (!("kind" in effect) || effect.kind === undefined) {
    applyLegacy(ctx, draft, effect as VariableEffect);
    return;
  }
  const scope = scopeFor(ctx, draft);
  switch (effect.kind) {
    case "formula": {
      const value = evaluateNumber(effect.formula, scope, 0);
      const current = num(draft.vars[effect.target]);
      const definition = ctx.variables.get(effect.target);
      if (definition && definition.type === "boolean") {
        draft.vars[effect.target] = value !== 0;
        break;
      }
      draft.vars[effect.target] = Math.round((effect.operation === "add" ? current + value : value) * 100) / 100;
      break;
    }
    case "restore":
      if (ctx.resources.has(effect.target)) draft.vars[effect.target] = resourceMax(ctx, draft, effect.target);
      break;
    case "item": {
      const quantity = Math.max(0, Math.round(evaluateNumber(effect.quantity, scope, 1)));
      if (effect.operation === "give") addItem(ctx, draft, effect.itemId, quantity);
      else removeItem(ctx, draft, effect.itemId, quantity);
      break;
    }
    case "equip": {
      const inBag = draft.bag.some((stack) => stack.itemId === effect.itemId);
      if (!inBag) addItem(ctx, draft, effect.itemId, 1);
      if (draft.bag.some((stack) => stack.itemId === effect.itemId)) equipItem(ctx, draft, effect.itemId, true);
      break;
    }
    case "unequip":
      unequipItem(ctx, draft, effect.itemId);
      break;
    case "loot": {
      const roll = roller(draft);
      for (const entry of effect.entries) {
        // Chance em porcentagem: rola 1d100.
        if (roll(100) <= Math.max(0, Math.min(100, entry.chance))) {
          addItem(ctx, draft, entry.itemId, Math.max(1, Math.round(evaluateNumber(entry.quantity, scope, 1))));
        }
      }
      break;
    }
    case "xp":
      if (ctx.on("progression")) {
        const key = ctx.system.progression.xpKey;
        draft.vars[key] = Math.max(0, num(draft.vars[key]) + Math.round(evaluateNumber(effect.amount, scope, 0)));
      }
      break;
    case "status": {
      const def = ctx.statusEffects.get(effect.effectId);
      if (!def) break;
      draft.effects = draft.effects.filter((active) => active.id !== def.id);
      if (effect.operation === "apply") draft.effects.push({ id: def.id, remaining: def.duration });
      break;
    }
    case "quest": {
      const quest = ctx.quests.get(effect.questId);
      if (!quest) break;
      const current = draft.quests[quest.id];
      if (effect.operation === "start" && !current) draft.quests[quest.id] = { state: "active", step: 0 };
      else if (effect.operation === "advance" && current?.state === "active") {
        current.step = Math.min(current.step + 1, Math.max(0, quest.steps.length - 1));
      } else if (effect.operation === "complete") draft.quests[quest.id] = { state: "done", step: Math.max(0, quest.steps.length - 1) };
      else if (effect.operation === "fail") draft.quests[quest.id] = { state: "failed", step: current?.step ?? 0 };
      break;
    }
    case "achievement":
      if (ctx.achievements.has(effect.achievementId) && !draft.achievements.includes(effect.achievementId)) {
        draft.achievements.push(effect.achievementId);
      }
      break;
  }
}

export function applyEffects(ctx: GameContext, draft: GameState, effects: Effect[]): void {
  for (const effect of effects) applyEffect(ctx, draft, effect);
  clampState(ctx, draft);
}

// Subiu de nível desde o último contado: ganha pontos e aplica os efeitos de subir, uma vez por
// nível. Pode ser chamado a qualquer momento (não conta o mesmo nível duas vezes).
export function settleLevel(ctx: GameContext, draft: GameState): void {
  if (!ctx.on("progression")) return;
  const progression = ctx.system.progression;
  const after = currentLevel(ctx, draft);
  for (let level = draft.level + 1; level <= after; level += 1) {
    draft.vars[progression.pointsKey] = num(draft.vars[progression.pointsKey]) + progression.pointsPerLevel;
    for (const effect of progression.onLevelUp) applyEffect(ctx, draft, effect, 1);
  }
  if (after > draft.level) draft.level = after;
  clampState(ctx, draft);
}

// Recurso zerado (ou cheio) depois de todos os efeitos: aplica os efeitos do gatilho e devolve a
// cena para onde ir (a da cena atual sobrescreve a padrão do recurso; null = fica).
export function checkTriggers(ctx: GameContext, draft: GameState): string | null {
  if (!ctx.on("resources")) return null;
  const scene = ctx.scenes.get(draft.sceneId);
  for (const resource of ctx.resources.values()) {
    const value = num(draft.vars[resource.key]);
    const max = resourceMax(ctx, draft, resource.key);
    const status = value <= 0 ? "zero" : max > 0 && value >= max ? "full" : "";
    if ((draft.triggers[resource.key] ?? "") === status) continue;
    draft.triggers[resource.key] = status;
    const trigger = status === "zero" ? resource.onZero : status === "full" ? resource.onFull : null;
    if (!trigger) continue;
    for (const effect of trigger.effects) applyEffect(ctx, draft, effect, 1);
    clampState(ctx, draft);
    const overrides = scene?.mechanics.onZero ?? {};
    const target = value <= 0 && resource.key in overrides ? overrides[resource.key] : trigger.sceneId;
    if (target && target !== draft.sceneId && ctx.scenes.has(target)) return target;
  }
  return null;
}
