import type { CombatActionDef, Creature } from "../../contracts/game";
import type { LocalizedText, StoryScene } from "../../contracts/types";
import type { GameContext } from "./context";
import { applyEffect, applyEffects, clampState, removeItem, scopeFor } from "./effects";
import { evaluateBoolean, evaluateNumber, num, type DiceRoll, type FormulaScope } from "./formula";
import { conditionsMet, playerScope, resourceMax } from "./rules";
import type { CombatLogLine, CombatState, GameState, RollView } from "./types";

// Combate por rodadas (0.12.0): o leitor escolhe uma ação, depois cada criatura age. As fórmulas
// enxergam `atacante.<chave>`, `defensor.<chave>` e `dado`; criatura tem os valores das mesmas
// chaves na ficha dela (stats), mais `hp` e `hp.max`.

const YOU: LocalizedText = { "pt-BR": "Você", en: "You", es: "Tú", fr: "Vous", it: "Tu", de: "Du", ja: "あなた" };

export function startCombat(ctx: GameContext, draft: GameState, scene: StoryScene): void {
  const encounter = scene.mechanics.encounter;
  if (!encounter || !ctx.on("combat")) {
    draft.combat = null;
    return;
  }
  const creatures: CombatState["creatures"] = [];
  for (const entry of encounter.creatures) {
    const creature = ctx.creatures.get(entry.creatureId);
    if (!creature) continue;
    if (!draft.seenCreatures.includes(creature.id)) draft.seenCreatures.push(creature.id);
    for (let index = 0; index < entry.count; index += 1) {
      creatures.push({ creatureId: creature.id, hp: creature.hp, maxHp: creature.hp, healed: false, fled: false });
    }
  }
  draft.combat = { sceneId: scene.id, creatures, round: 1, defending: false, result: creatures.length === 0 ? "victory" : null };
}

function creatureScope(creature: Creature, hp: number): FormulaScope {
  return {
    get(name) {
      if (name === "hp" || name === "vida") return hp;
      if (name === "hp.max") return creature.hp;
      return name in creature.stats ? creature.stats[name] : 0;
    },
  };
}

// Escopo de uma fórmula de combate: atacante./defensor. apontam para cada lado.
function combatScope(attacker: FormulaScope, defender: FormulaScope, die: number, base: FormulaScope): FormulaScope {
  return {
    roll: base.roll,
    onRoll: base.onRoll,
    get(name) {
      if (name === "dado" || name === "die") return die;
      if (name.startsWith("atacante.")) return attacker.get(name.slice(9)) ?? 0;
      if (name.startsWith("defensor.")) return defender.get(name.slice(9)) ?? 0;
      if (name.startsWith("alvo.")) return defender.get(name.slice(5)) ?? 0;
      return base.get(name);
    },
    call: base.call,
  };
}

function toRollView(rolls: DiceRoll[], label: LocalizedText, total: number, dc: number | null, outcome: RollView["outcome"]): RollView {
  return {
    label,
    notation: rolls.map((roll) => roll.notation).join(" + "),
    dice: rolls.map((roll) => ({ sides: Number(roll.notation.split("d")[1]?.split("k")[0] ?? 0), rolls: roll.rolls, kept: roll.kept })),
    total,
    dc,
    outcome,
  };
}

function lastEntry(draft: GameState) {
  return draft.entries[draft.entries.length - 1];
}

function log(draft: GameState, line: Omit<CombatLogLine, "round">) {
  const entry = lastEntry(draft);
  if (entry) entry.combat.push({ round: draft.combat?.round ?? 1, ...line });
}

function hpKey(ctx: GameContext): string | null {
  const key = ctx.system.combat.hpResource;
  return key && ctx.resources.has(key) ? key : null;
}

// Ataque do leitor numa criatura (ou de uma criatura no leitor).
function resolveAttack(
  ctx: GameContext,
  draft: GameState,
  formulas: { damage: string; reduction: string; hit: string },
  attacker: FormulaScope,
  defender: FormulaScope,
  extraReduction: number,
): { hit: boolean; amount: number; die: number; rolls: DiceRoll[] } {
  const rolls: DiceRoll[] = [];
  const base = scopeFor(ctx, draft, (roll) => rolls.push(roll));
  const die = evaluateNumber(ctx.system.combat.die, base, 1);
  const scope = combatScope(attacker, defender, die, base);
  if (formulas.hit.trim() && !evaluateBoolean(formulas.hit, scope, true)) return { hit: false, amount: 0, die, rolls };
  const raw = evaluateNumber(formulas.damage, scope, 0);
  const reduction = Math.max(0, Math.min(ctx.system.combat.maxReduction, evaluateNumber(formulas.reduction, scope, 0) + extraReduction));
  const amount = Math.max(ctx.system.combat.minDamage, Math.round(raw * (1 - reduction)));
  return { hit: true, amount, die, rolls };
}

function aliveTargets(state: CombatState) {
  return state.creatures.map((creature, index) => ({ creature, index })).filter(({ creature }) => creature.hp > 0 && !creature.fled);
}

function trainSkill(ctx: GameContext, draft: GameState, key: string | null): void {
  if (!key) return;
  const attribute = ctx.attributes.get(key);
  if (!attribute || !attribute.training.enabled) return;
  draft.training[key] = (draft.training[key] ?? 0) + 1;
  const value = num(draft.vars[key]);
  const threshold = evaluateNumber(attribute.training.threshold, { get: (name) => (name === "valor" || name === "value" ? value : undefined) }, Number.POSITIVE_INFINITY);
  if (draft.training[key] >= threshold) {
    draft.training[key] = 0;
    draft.vars[key] = value + 1;
  }
}

export type CombatInput = { action: string; target?: number; itemId?: string };

// Uma rodada. Devolve erro (texto) quando a ação não vale.
export function combatRound(ctx: GameContext, draft: GameState, input: CombatInput): string | null {
  const combat = draft.combat;
  if (!combat || combat.result) return "Não há luta em andamento.";
  const hp = hpKey(ctx);
  const player = playerScope(ctx, draft);
  combat.defending = false;
  const targets = aliveTargets(combat);
  const target = targets.find((entry) => entry.index === input.target) ?? targets[0];

  if (input.action === "defend") {
    if (!ctx.system.combat.defend.enabled) return "Defender não está disponível.";
    combat.defending = true;
    log(draft, { kind: "defend", actor: YOU, target: null, amount: null, action: null, roll: null });
  } else if (input.action === "flee") {
    if (!ctx.system.combat.flee.enabled) return "Fugir não está disponível.";
    const rolls: DiceRoll[] = [];
    const scope = scopeFor(ctx, draft, (roll) => rolls.push(roll));
    const total = evaluateNumber(ctx.system.combat.flee.roll, scope, 0);
    const dc = evaluateNumber(ctx.system.combat.flee.dc, scope, 10);
    const success = total >= dc;
    const roll = toRollView(rolls, { "pt-BR": "Fuga", en: "Flee" }, total, dc, success ? "success" : "failure");
    lastEntry(draft)?.rolls.push(roll);
    log(draft, { kind: success ? "flee" : "flee-fail", actor: YOU, target: null, amount: null, action: null, roll });
    if (success) {
      combat.result = "fled";
      return null;
    }
  } else if (input.action === "item") {
    const item = input.itemId ? ctx.items.get(input.itemId) : undefined;
    if (!item || item.useEffects.length === 0) return "Esse item não se usa.";
    if (!draft.bag.some((stack) => stack.itemId === item.id)) return "O item não está na mochila.";
    applyEffects(ctx, draft, item.useEffects);
    if (item.consumable) removeItem(ctx, draft, item.id, 1);
    log(draft, { kind: "item", actor: YOU, target: null, amount: null, action: item.name, roll: null });
  } else {
    const action: CombatActionDef | undefined = ctx.system.combat.actions.find((candidate) => candidate.key === input.action);
    if (!action) return "Ação desconhecida.";
    if (!target) return "Ninguém para atacar.";
    if (!conditionsMet(ctx, draft, action.requires)) return "Você não pode usar essa ação agora.";
    const scope = playerScope(ctx, draft);
    for (const cost of action.cost) {
      const amount = evaluateNumber(cost.amount, scope, 0);
      if (num(draft.vars[cost.resource]) < amount) return "Recurso insuficiente.";
    }
    for (const cost of action.cost) draft.vars[cost.resource] = num(draft.vars[cost.resource]) - evaluateNumber(cost.amount, scope, 0);
    const creature = ctx.creatures.get(target.creature.creatureId)!;
    const result = resolveAttack(ctx, draft, action, player, creatureScope(creature, target.creature.hp), 0);
    const roll = toRollView(result.rolls, action.name, result.amount, null, result.hit ? "success" : "failure");
    if (result.hit) target.creature.hp = Math.max(0, target.creature.hp - result.amount);
    log(draft, { kind: result.hit ? "attack" : "miss", actor: YOU, target: creature.name, amount: result.hit ? result.amount : null, action: action.name, roll });
    trainSkill(ctx, draft, action.trains);
  }

  clampState(ctx, draft);
  if (aliveTargets(combat).length === 0) {
    finishVictory(ctx, draft);
    return null;
  }

  // Vez das criaturas.
  for (const { creature: state } of aliveTargets(combat)) {
    const creature = ctx.creatures.get(state.creatureId)!;
    if (creature.behavior === "flee_low" && state.hp <= state.maxHp * 0.25) {
      state.fled = true;
      log(draft, { kind: "enemy-flee", actor: creature.name, target: null, amount: null, action: null, roll: null });
      continue;
    }
    if (creature.behavior === "heal_once" && !state.healed && state.hp <= state.maxHp * 0.5) {
      state.healed = true;
      const amount = Math.round(state.maxHp * 0.3);
      state.hp = Math.min(state.maxHp, state.hp + amount);
      log(draft, { kind: "heal", actor: creature.name, target: null, amount, action: null, roll: null });
      continue;
    }
    if (!hp) continue;
    const result = resolveAttack(
      ctx,
      draft,
      ctx.system.combat.enemy,
      creatureScope(creature, state.hp),
      playerScope(ctx, draft),
      combat.defending ? ctx.system.combat.defend.reductionBonus : 0,
    );
    if (result.hit) draft.vars[hp] = Math.max(0, num(draft.vars[hp]) - result.amount);
    log(draft, {
      kind: result.hit ? "attack" : "miss",
      actor: creature.name,
      target: YOU,
      amount: result.hit ? result.amount : null,
      action: null,
      roll: toRollView(result.rolls, creature.name, result.amount, null, result.hit ? "success" : "failure"),
    });
    if (num(draft.vars[hp]) <= 0) {
      combat.result = "defeat";
      log(draft, { kind: "defeat", actor: YOU, target: null, amount: null, action: null, roll: null });
      return null;
    }
  }
  if (aliveTargets(combat).length === 0) {
    finishVictory(ctx, draft);
    return null;
  }
  combat.round += 1;
  return null;
}

// Vitória: XP e saque das criaturas derrotadas (fugidas não contam).
function finishVictory(ctx: GameContext, draft: GameState): void {
  const combat = draft.combat!;
  combat.result = "victory";
  let xp = 0;
  for (const state of combat.creatures) {
    if (state.fled || state.hp > 0) continue;
    const creature = ctx.creatures.get(state.creatureId);
    if (!creature) continue;
    xp += creature.xp;
    if (creature.loot.length > 0) applyEffect(ctx, draft, { kind: "loot", entries: creature.loot });
  }
  if (xp > 0) applyEffect(ctx, draft, { kind: "xp", amount: String(xp) });
  clampState(ctx, draft);
  log(draft, { kind: "victory", actor: YOU, target: null, amount: xp || null, action: null, roll: null });
}

// Encontro de um teste só: sucesso vence; falha tira vida e vence se sobrar vida.
export function singleCombat(ctx: GameContext, draft: GameState, scene: StoryScene): string | null {
  const encounter = scene.mechanics.encounter;
  const combat = draft.combat;
  if (!encounter || !combat || combat.result) return "Não há luta em andamento.";
  const rolls: DiceRoll[] = [];
  const scope = scopeFor(ctx, draft, (roll) => rolls.push(roll));
  const total = evaluateNumber(encounter.single.roll, scope, 0);
  const dc = evaluateNumber(encounter.single.dc, scope, 10);
  const success = total >= dc;
  const names = combat.creatures.map((state) => ctx.creatures.get(state.creatureId)?.name).filter(Boolean) as LocalizedText[];
  const roll = toRollView(rolls, names[0] ?? { "pt-BR": "Luta" }, total, dc, success ? "success" : "failure");
  lastEntry(draft)?.rolls.push(roll);
  const hp = hpKey(ctx);
  if (!success && hp) {
    const loss = Math.max(0, Math.round(evaluateNumber(encounter.single.hpLoss, scope, 0)));
    draft.vars[hp] = Math.max(0, num(draft.vars[hp]) - loss);
    log(draft, { kind: "single", actor: names[0] ?? YOU, target: YOU, amount: loss, action: null, roll });
    if (num(draft.vars[hp]) <= 0) {
      combat.result = "defeat";
      return null;
    }
  } else {
    log(draft, { kind: "single", actor: YOU, target: names[0] ?? null, amount: null, action: null, roll });
  }
  for (const state of combat.creatures) state.hp = 0;
  finishVictory(ctx, draft);
  return null;
}

export function playerHp(ctx: GameContext, state: GameState): { value: number; max: number } | null {
  const key = hpKey(ctx);
  return key ? { value: num(state.vars[key]), max: resourceMax(ctx, state, key) } : null;
}
