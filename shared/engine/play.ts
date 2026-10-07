import type { ChoiceMechanics, Effect, ResourceDef, ShopDef } from "../../contracts/game";
import type { ChoiceRecord, LocalizedText, ReaderState, StoryScene, VariableValue } from "../../contracts/types";
import { initialVariables } from "../variables";
import type { GameContext } from "./context";
import { combatRound, singleCombat, startCombat } from "./combat";
import {
  addItem,
  applyEffect,
  applyEffects,
  checkTriggers,
  clampState,
  cloneState,
  equipItem,
  removeItem,
  scopeFor,
  settleLevel,
  storeOverflow,
  unequipItem,
} from "./effects";
import { evaluateNumber, num, type DiceRoll } from "./formula";
import { newSeed } from "./rng";
import {
  attributeCap,
  conditionsMet,
  currentLevel,
  fits,
  itemCount,
  label,
  playerScope,
  pointCost,
  resourceMax,
} from "./rules";
import type { ActionResult, Change, CombatState, GameState, PlayAction, RollView, SavedGame, Stack } from "./types";

// Motor da partida (0.10.0): aplica ações, decide o próximo passo e refaz a partida a partir do
// registro. Puro: roda no leitor, no servidor (conferência do progresso), no validador e no
// simulador.

export const MAX_PATH_LENGTH = 500;
export const MAX_LOG_LENGTH = 4000;
const MAX_REDIRECTS = 3;

// ------------------------------------------------------------------ resumo para o "o que mudou"

type SummaryEntry =
  | { kind: "value"; label: LocalizedText; value: number }
  | { kind: "flag"; label: LocalizedText; value: boolean }
  | { kind: "item"; label: LocalizedText; value: number }
  | { kind: "level"; label: LocalizedText; value: number }
  | { kind: "status"; label: LocalizedText; value: boolean }
  | { kind: "quest"; label: LocalizedText; value: string }
  | { kind: "achievement"; label: LocalizedText; value: boolean };

function summarize(ctx: GameContext, state: GameState): Map<string, SummaryEntry> {
  const summary = new Map<string, SummaryEntry>();
  for (const variable of ctx.variables.values()) {
    if (!variable.display || variable.display === "hidden") continue;
    const value = state.vars[variable.key] ?? variable.initial;
    const name = label(ctx, variable.label || variable.key);
    if (typeof value === "number") summary.set(`var:${variable.key}`, variable.display === "inventory" ? { kind: "item", label: name, value } : { kind: "value", label: name, value });
    else summary.set(`var:${variable.key}`, variable.display === "inventory" ? { kind: "item", label: name, value: value ? 1 : 0 } : { kind: "flag", label: name, value });
  }
  for (const resource of ctx.resources.values()) {
    summary.set(`res:${resource.key}`, { kind: "value", label: Object.keys(resource.abbr).length ? resource.abbr : resource.name, value: num(state.vars[resource.key]) });
  }
  for (const attribute of ctx.attributes.values()) {
    summary.set(`attr:${attribute.key}`, { kind: "value", label: attribute.name, value: num(state.vars[attribute.key]) });
  }
  if (ctx.on("progression")) {
    const progression = ctx.system.progression;
    summary.set("xp", { kind: "value", label: progression.xpName, value: num(state.vars[progression.xpKey]) });
    summary.set("level", { kind: "level", label: progression.levelName, value: currentLevel(ctx, state) });
    summary.set("points", { kind: "value", label: progression.pointsName, value: num(state.vars[progression.pointsKey]) });
  }
  if (ctx.on("shops") && ctx.system.currency.mode === "counter") {
    summary.set("currency", { kind: "value", label: ctx.system.currency.name, value: num(state.vars[ctx.system.currency.key]) });
  }
  for (const item of ctx.items.values()) {
    const count = itemCount(ctx, state, item.id) + state.overflow.filter((stack) => stack.itemId === item.id).reduce((sum, stack) => sum + stack.quantity, 0);
    if (count > 0) summary.set(`item:${item.id}`, { kind: "item", label: item.name, value: count });
  }
  for (const active of state.effects) {
    const def = ctx.statusEffects.get(active.id);
    if (def) summary.set(`status:${def.id}`, { kind: "status", label: def.name, value: true });
  }
  for (const [id, quest] of Object.entries(state.quests)) {
    const def = ctx.quests.get(id);
    if (def) summary.set(`quest:${id}`, { kind: "quest", label: def.name, value: `${quest.state}:${quest.step}` });
  }
  for (const id of state.achievements) {
    const def = ctx.achievements.get(id);
    if (def) summary.set(`ach:${id}`, { kind: "achievement", label: def.name, value: true });
  }
  return summary;
}

function diff(before: Map<string, SummaryEntry>, after: Map<string, SummaryEntry>): Change[] {
  const changes: Change[] = [];
  const keys = new Set([...before.keys(), ...after.keys()]);
  for (const key of keys) {
    const a = before.get(key);
    const b = after.get(key);
    const entry = b ?? a!;
    switch (entry.kind) {
      case "value": {
        const delta = Math.round((num((b as { value: number } | undefined)?.value) - num((a as { value: number } | undefined)?.value)) * 100) / 100;
        if (delta !== 0) changes.push({ type: "value", key, label: entry.label, delta });
        break;
      }
      case "item": {
        const delta = num((b as { value: number } | undefined)?.value) - num((a as { value: number } | undefined)?.value);
        if (delta !== 0) changes.push({ type: "item", key, label: entry.label, delta });
        break;
      }
      case "flag":
        if (a?.value !== b?.value) changes.push({ type: "flag", key, label: entry.label, value: Boolean(b?.value) });
        break;
      case "level":
        if (b && a && b.value !== a.value && num(b.value) > num(a.value)) changes.push({ type: "level", key, label: entry.label, value: num(b.value) });
        break;
      case "status":
        if (Boolean(a) !== Boolean(b)) changes.push({ type: "status", key, label: entry.label, on: Boolean(b) });
        break;
      case "quest":
        if (a?.value !== b?.value && b) {
          const [state, step] = String(b.value).split(":");
          const previous = a ? String(a.value).split(":")[0] : null;
          changes.push({
            type: "quest",
            key,
            label: entry.label,
            state: state === previous && state === "active" && step !== "0" ? "step" : (state as "active" | "done" | "failed"),
          });
        }
        break;
      case "achievement":
        if (!a && b) changes.push({ type: "achievement", key, label: entry.label });
        break;
    }
  }
  return changes;
}

// ------------------------------------------------------------------ cenas

function firstSceneId(ctx: GameContext): string | null {
  const ordered = [...ctx.story.chapters].sort((a, b) => a.position - b.position);
  return ordered.find((chapter) => chapter.startSceneId && ctx.scenes.has(chapter.startSceneId))?.startSceneId ?? null;
}

function followingChapter(ctx: GameContext, chapterId: string) {
  const ordered = [...ctx.story.chapters].sort((a, b) => a.position - b.position);
  const position = ordered.findIndex((chapter) => chapter.id === chapterId);
  return position >= 0 ? (ordered[position + 1] ?? null) : null;
}

function enterScene(ctx: GameContext, draft: GameState, sceneId: string): void {
  const scene = ctx.scenes.get(sceneId);
  if (!scene) return;
  draft.sceneId = sceneId;
  draft.path.push(sceneId);
  draft.entries.push({ sceneId, changes: [], rolls: [], combat: [] });
  if (draft.path.length > MAX_PATH_LENGTH) {
    draft.path.shift();
    draft.entries.shift();
  }
  draft.ground = [];
  draft.combat = null;
  draft.rerollBase = null;
  applyEffects(ctx, draft, scene.effects);
  // Efeitos com duração: aplicam o efeito por cena e contam uma cena a menos.
  if (ctx.on("effects")) {
    const remaining: GameState["effects"] = [];
    for (const active of draft.effects) {
      const def = ctx.statusEffects.get(active.id);
      if (!def) continue;
      for (const effect of def.perScene) applyEffect(ctx, draft, effect, 1);
      const left = active.remaining === null ? null : active.remaining - 1;
      if (left === null || left > 0) remaining.push({ id: active.id, remaining: left });
    }
    draft.effects = remaining;
  }
  if (ctx.on("resources") && !scene.mechanics.noRegen) {
    const inCombat = scene.mechanics.kind === "encounter";
    const scope = playerScope(ctx, draft);
    for (const resource of ctx.resources.values()) {
      if (!resource.regen.trim() || (inCombat && !resource.regenInCombat)) continue;
      draft.vars[resource.key] = num(draft.vars[resource.key]) + evaluateNumber(resource.regen, scope, 0);
    }
  }
  clampState(ctx, draft);
  if (scene.isEnding && !draft.visitedEndings.includes(scene.id)) draft.visitedEndings.push(scene.id);
  if (scene.mechanics.kind === "encounter") startCombat(ctx, draft, scene);
}

// Entra na cena e resolve gatilhos (recurso zerado leva a outra cena), no máximo 3 saltos.
function moveTo(ctx: GameContext, draft: GameState, sceneId: string): void {
  enterScene(ctx, draft, sceneId);
  settleLevel(ctx, draft);
  for (let jump = 0; jump < MAX_REDIRECTS; jump += 1) {
    const redirect = checkTriggers(ctx, draft);
    if (!redirect) break;
    enterScene(ctx, draft, redirect);
  }
}

// ------------------------------------------------------------------ escolhas

export type ChoiceView = {
  choice: ChoiceRecord;
  enabled: boolean;
  reason: string | null;
  costs: { resource: ResourceDef; amount: number }[];
  test: { label: LocalizedText; dc: number | null } | null;
};

function mechanicsOf(choice: ChoiceRecord): ChoiceMechanics {
  return choice.mechanics ?? { cost: [], whenUnavailable: "hide", test: null };
}

export function choiceViews(ctx: GameContext, state: GameState): ChoiceView[] {
  const views: ChoiceView[] = [];
  const scope = playerScope(ctx, state);
  for (const choice of ctx.choicesByScene.get(state.sceneId) ?? []) {
    if (!ctx.scenes.has(choice.targetSceneId)) continue;
    const mechanics = mechanicsOf(choice);
    const costs = ctx.on("resources")
      ? mechanics.cost
          .map((cost) => ({ resource: ctx.resources.get(cost.resource), amount: Math.max(0, evaluateNumber(cost.amount, scope, 0)) }))
          .filter((cost): cost is { resource: ResourceDef; amount: number } => Boolean(cost.resource))
      : [];
    const conditionsOk = conditionsMet(ctx, state, choice.conditions);
    const shortage = costs.find((cost) => num(state.vars[cost.resource.key]) < cost.amount);
    const enabled = conditionsOk && !shortage;
    if (!enabled && mechanics.whenUnavailable === "hide") continue;
    const resourceName = shortage ? (shortage.resource.name[ctx.locale] ?? Object.values(shortage.resource.name)[0] ?? shortage.resource.key) : "";
    views.push({
      choice,
      enabled,
      reason: enabled ? null : shortage ? `${resourceName} insuficiente` : "Requisitos não atendidos",
      costs,
      test:
        ctx.on("dice") && mechanics.test
          ? { label: mechanics.test.label, dc: mechanics.test.bands.length > 0 ? null : evaluateNumber(mechanics.test.dc, scope, 10) }
          : null,
    });
  }
  return views;
}

export type Step =
  | { kind: "new-game" }
  | { kind: "overflow"; stacks: Stack[] }
  | { kind: "combat"; combat: CombatState; mode: "rounds" | "single" }
  | { kind: "choices"; choices: ChoiceView[]; shop: ShopDef | null }
  | { kind: "next-chapter"; chapterId: string; sceneId: string }
  | { kind: "ending"; scene: StoryScene }
  | { kind: "dead-end"; shop: ShopDef | null };

export function nextStep(ctx: GameContext, state: GameState): Step {
  if (!state.started) return { kind: "new-game" };
  const scene = ctx.scenes.get(state.sceneId);
  if (!scene) return { kind: "dead-end", shop: null };
  if (state.overflow.length > 0) return { kind: "overflow", stacks: state.overflow };
  if (scene.isEnding) return { kind: "ending", scene };
  if (state.combat && !state.combat.result) {
    return { kind: "combat", combat: state.combat, mode: scene.mechanics.encounter?.mode ?? "rounds" };
  }
  const shop = ctx.on("shops") && scene.mechanics.kind === "shop" ? scene.mechanics.shop : null;
  const sceneChoices = ctx.choicesByScene.get(scene.id) ?? [];
  if (sceneChoices.length > 0) {
    const views = choiceViews(ctx, state);
    return views.length > 0 ? { kind: "choices", choices: views, shop } : { kind: "dead-end", shop };
  }
  const next = followingChapter(ctx, scene.chapterId);
  if (next?.startSceneId && ctx.scenes.has(next.startSceneId)) return { kind: "next-chapter", chapterId: next.id, sceneId: next.startSceneId };
  return { kind: "dead-end", shop };
}

function toRollView(rolls: DiceRoll[], name: LocalizedText, total: number, dc: number | null, outcome: RollView["outcome"]): RollView {
  return {
    label: name,
    notation: rolls.map((roll) => roll.notation).join(" + "),
    dice: rolls.map((roll) => ({ sides: Number(roll.notation.split("d")[1]?.split("k")[0] ?? 0), rolls: roll.rolls, kept: roll.kept })),
    total,
    dc,
    outcome,
  };
}

// Teste de dados da escolha: rola, compara com a dificuldade (ou faixas) e diz para onde vai.
function resolveTest(ctx: GameContext, draft: GameState, choice: ChoiceRecord): { target: string; effects: Effect[]; roll: RollView } | null {
  const test = mechanicsOf(choice).test;
  if (!test || !ctx.on("dice")) return null;
  const rolls: DiceRoll[] = [];
  const scope = scopeFor(ctx, draft, (roll) => rolls.push(roll));
  const total = Math.round(evaluateNumber(test.roll, scope, 0) * 100) / 100;
  const single = rolls.length === 1 && rolls[0].kept.length === 1 ? rolls[0] : null;
  const sides = single ? Number(single.notation.split("d")[1]?.split("k")[0] ?? 0) : 0;
  const natural = single?.kept[0] ?? null;
  if (test.bands.length > 0) {
    const band = test.bands.find((candidate) => total >= candidate.min && total <= candidate.max) ?? test.bands.at(-1)!;
    return { target: band.targetSceneId, effects: band.effects, roll: toRollView(rolls, test.label, total, null, "band") };
  }
  const dc = evaluateNumber(test.dc, scope, 10);
  if (natural !== null && natural === sides && test.critical) {
    return { target: test.critical.targetSceneId, effects: test.critical.effects, roll: toRollView(rolls, test.label, total, dc, "critical") };
  }
  if (natural === 1 && test.fumble) {
    return { target: test.fumble.targetSceneId, effects: test.fumble.effects, roll: toRollView(rolls, test.label, total, dc, "fumble") };
  }
  if (total >= dc) return { target: choice.targetSceneId, effects: test.successEffects, roll: toRollView(rolls, test.label, total, dc, "success") };
  return { target: test.failure.targetSceneId || choice.targetSceneId, effects: test.failure.effects, roll: toRollView(rolls, test.label, total, dc, "failure") };
}

function applyChoose(ctx: GameContext, draft: GameState, choiceId: string): string | null {
  const view = choiceViews(ctx, draft).find((candidate) => candidate.choice.id === choiceId);
  const step = nextStep(ctx, draft);
  if (step.kind !== "choices" || !view || !view.enabled) return "Essa escolha não está disponível.";
  const base = cloneState(draft);
  const counterBefore = draft.counter;
  for (const cost of view.costs) draft.vars[cost.resource.key] = num(draft.vars[cost.resource.key]) - cost.amount;
  applyEffects(ctx, draft, view.choice.effects);
  const test = resolveTest(ctx, draft, view.choice);
  if (test) applyEffects(ctx, draft, test.effects);
  settleLevel(ctx, draft);
  const target = test && ctx.scenes.has(test.target) ? test.target : view.choice.targetSceneId;
  const redirect = checkTriggers(ctx, draft);
  const entriesBefore = draft.entries.length;
  moveTo(ctx, draft, redirect ?? target);
  settleLevel(ctx, draft);
  if (test) {
    const entry = draft.entries[Math.min(entriesBefore, draft.entries.length - 1)];
    entry?.rolls.unshift(test.roll);
    draft.rerollBase = { state: base, choiceId, rolls: draft.counter - counterBefore };
  }
  return null;
}

// ------------------------------------------------------------------ início da partida

export type NewGameOptions = {
  seed?: string;
  start?: Extract<PlayAction, { t: "start" }>;
  visitedEndings?: string[];
  achievements?: string[];
};

function blankState(ctx: GameContext, seed: string, visitedEndings: string[], achievements: string[]): GameState {
  const vars: Record<string, VariableValue> = { ...initialVariables(ctx.story.work.variables) };
  for (const attribute of ctx.attributes.values()) vars[attribute.key] = attribute.initial;
  if (ctx.on("progression")) {
    vars[ctx.system.progression.xpKey] = 0;
    vars[ctx.system.progression.pointsKey] = 0;
  }
  if (ctx.on("shops") && ctx.system.currency.mode === "counter") vars[ctx.system.currency.key] = 0;
  for (const resource of ctx.resources.values()) vars[resource.key] = 0;
  return {
    started: false,
    sceneId: "",
    path: [],
    entries: [],
    vars,
    visitedEndings: [...visitedEndings],
    achievements: [...achievements],
    bag: [],
    equipped: {},
    overflow: [],
    ground: [],
    effects: [],
    quests: {},
    training: {},
    profile: {},
    vocationId: null,
    combat: null,
    shopStock: {},
    seenCreatures: [],
    hardcore: false,
    triggers: {},
    level: 1,
    seed,
    counter: 0,
    log: [],
    rerollBase: null,
  };
}

// Estado inicial sem cena (prévia de fórmula no editor, simulador de combate): atributos no valor
// inicial e recursos cheios.
export function sampleState(ctx: GameContext, seed = "preview"): GameState {
  const state = blankState(ctx, seed, [], []);
  for (const resource of ctx.resources.values()) state.vars[resource.key] = resourceMax(ctx, state, resource.key);
  state.started = true;
  return state;
}

function applyStart(ctx: GameContext, draft: GameState, action: Extract<PlayAction, { t: "start" }>): string | null {
  const first = firstSceneId(ctx);
  if (!first) return "A obra ainda não tem cena inicial.";
  const character = ctx.system.character;
  if (ctx.on("character")) {
    for (const field of character.fields) {
      const raw = (action.profile?.[field.key] ?? "").toString().trim().slice(0, 40);
      if (field.kind === "choice") {
        draft.profile[field.key] = field.options.some((option) => option.value === raw) ? raw : field.fallback;
      } else {
        draft.profile[field.key] = raw || field.fallback;
      }
    }
    const vocation = character.vocations.find((candidate) => candidate.id === action.vocationId) ?? null;
    if (character.vocations.length > 0 && !vocation) return "Escolha uma vocação.";
    if (vocation) {
      draft.vocationId = vocation.id;
      for (const [key, value] of Object.entries(vocation.values)) draft.vars[key] = value;
    }
    // Pontos iniciais: mesmo custo crescente e tetos da distribuição de nível.
    let budget = character.startingPoints;
    for (const [key, amount] of Object.entries(action.allocations ?? {})) {
      if (!ctx.attributes.has(key)) continue;
      for (let index = 0; index < Math.max(0, Math.trunc(amount)); index += 1) {
        const value = num(draft.vars[key]);
        const cost = pointCost(ctx, value);
        if (cost > budget || value + 1 > attributeCap(ctx, draft, key)) break;
        budget -= cost;
        draft.vars[key] = value + 1;
      }
    }
  }
  for (const [key, value] of Object.entries(action.carry ?? {})) {
    if (ctx.system.series.carry.includes(key) && (typeof value === "number" || typeof value === "boolean")) draft.vars[key] = value;
  }
  draft.hardcore = ctx.system.hardcore && Boolean(action.hardcore);
  // Recursos começam pelo valor inicial (fórmula ou "max"), já com atributos e vocação.
  const scope = playerScope(ctx, draft);
  for (const resource of ctx.resources.values()) {
    if (num(draft.vars[resource.key]) > 0) continue;
    const max = resourceMax(ctx, draft, resource.key);
    draft.vars[resource.key] = resource.initial.trim() === "" || resource.initial.trim() === "max" ? max : evaluateNumber(resource.initial, scope, max);
  }
  const vocation = character.vocations.find((candidate) => candidate.id === draft.vocationId);
  for (const entry of vocation?.items ?? []) addItem(ctx, draft, entry.itemId, entry.quantity);
  clampState(ctx, draft);
  draft.started = true;
  moveTo(ctx, draft, first);
  return null;
}

export function newGame(ctx: GameContext, options: NewGameOptions = {}): ActionResult {
  const state = blankState(ctx, options.seed ?? newSeed(), options.visitedEndings ?? [], options.achievements ?? []);
  return applyAction(ctx, state, options.start ?? { t: "start" });
}

// ------------------------------------------------------------------ ações

function lastAction(state: GameState): PlayAction | undefined {
  return state.log[state.log.length - 1];
}

export function applyAction(ctx: GameContext, state: GameState, action: PlayAction): ActionResult {
  if (state.log.length >= MAX_LOG_LENGTH) return { ok: false, reason: "Partida longa demais." };
  if (action.t !== "start" && !state.started) return { ok: false, reason: "A partida não começou." };
  if (action.t === "start" && state.started) return { ok: false, reason: "A partida já começou." };

  // "Rolar de novo": volta para antes do teste, paga o custo e rola com dados novos.
  if (action.t === "reroll") {
    const base = state.rerollBase;
    const previous = lastAction(state);
    if (!base || !ctx.on("dice") || !ctx.system.dice.reroll.enabled || state.hardcore) return { ok: false, reason: "Não dá para rolar de novo." };
    if (previous?.t !== "choose" && previous?.t !== "reroll") return { ok: false, reason: "Não dá para rolar de novo." };
    const draft = cloneState(base.state);
    const scope = playerScope(ctx, draft);
    for (const cost of ctx.system.dice.reroll.cost) {
      const amount = evaluateNumber(cost.amount, scope, 0);
      if (num(draft.vars[cost.resource]) < amount) return { ok: false, reason: "Recurso insuficiente para rolar de novo." };
      draft.vars[cost.resource] = num(draft.vars[cost.resource]) - amount;
    }
    draft.counter += Math.max(1, base.rolls);
    const before = summarize(ctx, base.state);
    const rerollBase = cloneState(draft);
    const error = applyChoose(ctx, draft, base.choiceId);
    if (error) return { ok: false, reason: error };
    draft.rerollBase = { state: rerollBase, choiceId: base.choiceId, rolls: draft.rerollBase?.rolls ?? base.rolls };
    draft.entries[draft.entries.length - 1]?.changes.push(...diff(before, summarize(ctx, draft)));
    draft.log = [...state.log, action];
    return { ok: true, state: draft };
  }

  const draft = cloneState(state);
  const before = summarize(ctx, state);
  const scene = ctx.scenes.get(state.sceneId);
  let error: string | null = null;
  const inCombat = Boolean(state.combat && !state.combat.result);

  switch (action.t) {
    case "start":
      error = applyStart(ctx, draft, action);
      break;
    case "choose":
      error = applyChoose(ctx, draft, action.choiceId);
      break;
    case "continue": {
      const step = nextStep(ctx, state);
      if (step.kind !== "next-chapter") error = "Não há próximo capítulo agora.";
      else moveTo(ctx, draft, step.sceneId);
      break;
    }
    case "equip":
      if (inCombat) error = "Durante a luta, só ações de combate.";
      else if (!ctx.on("equipment")) error = "Equipamento desligado.";
      else {
        const item = ctx.items.get(action.itemId);
        if (!item) error = "Item desconhecido.";
        else if (!item.requirements.every((requirement) => num(state.vars[requirement.key]) >= requirement.min)) error = "Você ainda não atende os requisitos desse item.";
        else error = equipItem(ctx, draft, action.itemId, true);
      }
      break;
    case "unequip":
      if (inCombat) error = "Durante a luta, só ações de combate.";
      else error = unequipItem(ctx, draft, action.itemId);
      break;
    case "use": {
      const item = ctx.items.get(action.itemId);
      if (inCombat) error = "Na luta, use o item pela ação de combate.";
      else if (!item || item.useEffects.length === 0) error = "Esse item não se usa.";
      else if (!draft.bag.some((stack) => stack.itemId === item.id) && !draft.overflow.some((stack) => stack.itemId === item.id)) error = "O item não está com você.";
      else {
        applyEffects(ctx, draft, item.useEffects);
        if (item.consumable) removeItem(ctx, draft, item.id, 1);
      }
      break;
    }
    case "drop": {
      const item = ctx.items.get(action.itemId);
      const quantity = Math.max(1, Math.trunc(action.quantity));
      if (!item) error = "Item desconhecido.";
      else if (!item.droppable) error = "Esse item não pode ser largado.";
      else {
        const taken = (() => {
          const fromOverflow = draft.overflow.find((stack) => stack.itemId === item.id);
          if (fromOverflow) {
            const amount = Math.min(fromOverflow.quantity, quantity);
            draft.overflow = draft.overflow
              .map((stack) => (stack.itemId === item.id ? { ...stack, quantity: stack.quantity - amount } : stack))
              .filter((stack) => stack.quantity > 0);
            return amount;
          }
          const inBag = draft.bag.find((stack) => stack.itemId === item.id);
          if (!inBag) return 0;
          const amount = Math.min(inBag.quantity, quantity);
          draft.bag = draft.bag
            .map((stack) => (stack.itemId === item.id ? { ...stack, quantity: stack.quantity - amount } : stack))
            .filter((stack) => stack.quantity > 0);
          return amount;
        })();
        if (taken === 0) error = "O item não está na mochila.";
        else {
          const onGround = draft.ground.find((stack) => stack.itemId === item.id);
          draft.ground = onGround
            ? draft.ground.map((stack) => (stack.itemId === item.id ? { ...stack, quantity: stack.quantity + taken } : stack))
            : [...draft.ground, { itemId: item.id, quantity: taken }];
        }
      }
      break;
    }
    case "pickup": {
      const onGround = draft.ground.find((stack) => stack.itemId === action.itemId);
      if (!onGround) error = "Não há esse item no chão.";
      else if (!fits(ctx, draft, action.itemId, 1)) error = "Não cabe na mochila.";
      else {
        let picked = 0;
        while (picked < onGround.quantity && fits(ctx, draft, action.itemId, 1)) {
          addItem(ctx, draft, action.itemId, 1);
          picked += 1;
        }
        draft.ground = draft.ground
          .map((stack) => (stack.itemId === action.itemId ? { ...stack, quantity: stack.quantity - picked } : stack))
          .filter((stack) => stack.quantity > 0);
      }
      break;
    }
    case "discard":
      if (draft.overflow.length === 0) error = "Nada sobrando para recusar.";
      else draft.overflow = [];
      break;
    case "allocate": {
      const progression = ctx.system.progression;
      const attribute = ctx.attributes.get(action.key);
      if (!ctx.on("progression") || !attribute) error = "Atributo desconhecido.";
      else {
        const value = num(draft.vars[attribute.key]);
        const cost = pointCost(ctx, value);
        if (num(draft.vars[progression.pointsKey]) < cost) error = "Pontos insuficientes.";
        else if (value + 1 > attributeCap(ctx, draft, attribute.key)) error = "Esse atributo já está no teto para o seu nível.";
        else {
          draft.vars[progression.pointsKey] = num(draft.vars[progression.pointsKey]) - cost;
          draft.vars[attribute.key] = value + 1;
        }
      }
      break;
    }
    case "combat": {
      if (!scene || !inCombat) {
        error = "Não há luta em andamento.";
        break;
      }
      error = action.action === "single" ? singleCombat(ctx, draft, scene) : combatRound(ctx, draft, action);
      if (error) break;
      settleLevel(ctx, draft);
      const result = draft.combat?.result;
      const encounter = scene.mechanics.encounter;
      if (result === "victory" && encounter?.victorySceneId && ctx.scenes.has(encounter.victorySceneId)) moveTo(ctx, draft, encounter.victorySceneId);
      else if (result === "fled" && encounter?.fleeSceneId && ctx.scenes.has(encounter.fleeSceneId)) moveTo(ctx, draft, encounter.fleeSceneId);
      else if (result === "defeat") {
        if (encounter?.defeatSceneId && ctx.scenes.has(encounter.defeatSceneId)) moveTo(ctx, draft, encounter.defeatSceneId);
        else {
          const redirect = checkTriggers(ctx, draft);
          if (redirect) moveTo(ctx, draft, redirect);
        }
      }
      break;
    }
    case "buy": {
      const shop = scene?.mechanics.kind === "shop" ? scene.mechanics.shop : null;
      const entry = shop?.items.find((candidate) => candidate.itemId === action.itemId);
      if (!ctx.on("shops") || !shop || !entry) error = "Esse item não está à venda aqui.";
      else {
        const stock = draft.shopStock[scene!.id]?.[entry.itemId] ?? entry.stock;
        if (stock !== null && stock <= 0) error = "Esgotado.";
        else if (!spend(ctx, draft, entry.price)) error = `${ctx.system.currency.name[ctx.locale] ?? "Dinheiro"} insuficiente.`;
        else {
          addItem(ctx, draft, entry.itemId, 1);
          if (stock !== null) (draft.shopStock[scene!.id] ??= {})[entry.itemId] = stock - 1;
        }
      }
      break;
    }
    case "sell": {
      const shop = scene?.mechanics.kind === "shop" ? scene.mechanics.shop : null;
      const item = ctx.items.get(action.itemId);
      if (!ctx.on("shops") || !shop || !item || item.value <= 0 || !item.droppable) error = "Não dá para vender esse item aqui.";
      else if (removeItem(ctx, draft, item.id, 1) === 0) error = "O item não está com você.";
      else earn(ctx, draft, Math.floor(item.value * shop.sellRate));
      break;
    }
    default:
      error = "Ação desconhecida.";
  }
  if (error) return { ok: false, reason: error };
  settleLevel(ctx, draft);

  if (action.t !== "start" && action.t !== "choose" && action.t !== "continue" && action.t !== "combat") {
    storeOverflow(ctx, draft);
    // Usar um item pode zerar (ou encher) um recurso: o gatilho vale aqui também.
    const redirect = checkTriggers(ctx, draft);
    if (redirect) moveTo(ctx, draft, redirect);
  }
  if (action.t !== "choose") draft.rerollBase = null;
  const changes = action.t === "start" ? [] : diff(before, summarize(ctx, draft));
  draft.entries[draft.entries.length - 1]?.changes.push(...changes);
  draft.log.push(action);
  return { ok: true, state: draft };
}

function currencyAmount(ctx: GameContext, state: GameState): number {
  const currency = ctx.system.currency;
  if (currency.mode === "item" && currency.itemId) return itemCount(ctx, state, currency.itemId);
  return num(state.vars[currency.key]);
}

function spend(ctx: GameContext, draft: GameState, amount: number): boolean {
  if (currencyAmount(ctx, draft) < amount) return false;
  const currency = ctx.system.currency;
  if (currency.mode === "item" && currency.itemId) removeItem(ctx, draft, currency.itemId, amount);
  else draft.vars[currency.key] = num(draft.vars[currency.key]) - amount;
  return true;
}

function earn(ctx: GameContext, draft: GameState, amount: number): void {
  const currency = ctx.system.currency;
  if (currency.mode === "item" && currency.itemId) addItem(ctx, draft, currency.itemId, amount);
  else draft.vars[currency.key] = num(draft.vars[currency.key]) + amount;
}

export function currency(ctx: GameContext, state: GameState): number {
  return currencyAmount(ctx, state);
}

// ------------------------------------------------------------------ registro

// Refaz a partida a partir do registro salvo. Ação que não vale mais (o autor mudou a obra) corta o
// registro ali: o leitor continua do último ponto válido.
export function replay(ctx: GameContext, saved: SavedGame): { state: GameState; truncated: boolean } {
  const [start, ...rest] = saved.log;
  const first = newGame(ctx, {
    seed: saved.seed,
    start: start?.t === "start" ? start : { t: "start" },
    visitedEndings: saved.visitedEndings,
    achievements: saved.achievements,
  });
  if (!first.ok) {
    const blank = blankState(ctx, saved.seed, saved.visitedEndings, saved.achievements);
    return { state: blank, truncated: true };
  }
  let state = first.state;
  for (const action of rest) {
    const result = applyAction(ctx, state, action);
    if (!result.ok) return { state, truncated: true };
    state = result.state;
  }
  return { state, truncated: false };
}

export function toSaved(state: GameState): SavedGame {
  return { v: 2, seed: state.seed, log: state.log, visitedEndings: state.visitedEndings, achievements: state.achievements };
}

// Voltar para a última escolha: refaz a partida sem a última escolha (e o que veio depois). Os
// finais e conquistas descobertos continuam. Modo hardcore não volta.
export function undo(ctx: GameContext, state: GameState): GameState | null {
  if (state.hardcore) return null;
  let index = -1;
  for (let position = state.log.length - 1; position > 0; position -= 1) {
    if (state.log[position].t === "choose") {
      index = position;
      break;
    }
  }
  if (index < 0) return null;
  const { state: previous } = replay(ctx, {
    v: 2,
    seed: state.seed,
    log: state.log.slice(0, index),
    visitedEndings: state.visitedEndings,
    achievements: state.achievements,
  });
  return { ...previous, visitedEndings: [...state.visitedEndings], achievements: [...state.achievements] };
}

// Progresso salvo antes da 0.10.0 (cena + variáveis + caminho): vira registro de ações
// reconstruindo as escolhas entre cenas seguidas do caminho.
export function fromLegacy(ctx: GameContext, legacy: ReaderState, seed = newSeed()): GameState | null {
  const first = newGame(ctx, { seed, visitedEndings: legacy.visitedEndings ?? [] });
  if (!first.ok) return null;
  let state = first.state;
  const path = (legacy.path ?? []).filter((sceneId) => ctx.scenes.has(sceneId));
  for (const sceneId of path.slice(1)) {
    const choice = (ctx.choicesByScene.get(state.sceneId) ?? []).find((candidate) => candidate.targetSceneId === sceneId);
    const result = choice ? applyAction(ctx, state, { t: "choose", choiceId: choice.id }) : applyAction(ctx, state, { t: "continue" });
    if (!result.ok || result.state.sceneId !== sceneId) break;
    state = result.state;
  }
  return state;
}

export function isSavedGame(value: unknown): value is SavedGame {
  return Boolean(value) && typeof value === "object" && (value as SavedGame).v === 2 && Array.isArray((value as SavedGame).log);
}

// Usado pelo leitor para saber se pode distribuir pontos agora.
export function canAllocate(ctx: GameContext, state: GameState, key: string): boolean {
  if (!ctx.on("progression") || !ctx.attributes.has(key)) return false;
  const value = num(state.vars[key]);
  return num(state.vars[ctx.system.progression.pointsKey]) >= pointCost(ctx, value) && value + 1 <= attributeCap(ctx, state, key);
}

export { currentLevel, resourceMax };
