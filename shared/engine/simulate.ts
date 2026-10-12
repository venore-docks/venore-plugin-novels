import type { GameContext } from "./context";
import { combatRound, startCombat } from "./combat";
import { cloneState } from "./effects";
import { num } from "./formula";
import { applyAction, newGame, nextStep, sampleState } from "./play";
import { randomAt } from "./rng";
import { attributeCap, pointCost, xpForLevel } from "./rules";
import type { GameState, PlayAction } from "./types";

// Simulador de balanceamento (seção 13 do documento): o mesmo motor do leitor jogando sozinho.
// Roda no navegador do autor, em lotes, sem servidor.

export type RunSummary = {
  runs: number;
  endings: Map<string, number>;
  stuck: Map<string, number>;
  deaths: Map<string, number>;
  visited: Map<string, number>;
  averageSteps: number;
};

const MAX_STEPS = 400;

function pick<T>(list: T[], seed: string, counter: number): T {
  return list[Math.floor(randomAt(seed, counter) * list.length)];
}

// Uma partida com escolhas aleatórias. Ficha: vocação e pontos aleatórios.
export function simulateRun(ctx: GameContext, seed: string): { state: GameState; steps: number; death: string | null } {
  const character = ctx.system.character;
  let counter = 10_000;
  const allocations: Record<string, number> = {};
  if (ctx.on("character")) {
    const stats = [...ctx.attributes.values()].filter((attribute) => attribute.kind === "stat");
    for (let point = 0; point < character.startingPoints && stats.length > 0; point += 1) {
      const key = pick(stats, seed, counter++).key;
      allocations[key] = (allocations[key] ?? 0) + 1;
    }
  }
  const start: PlayAction = {
    t: "start",
    vocationId: character.vocations.length > 0 ? pick(character.vocations, seed, counter++).id : null,
    allocations,
  };
  const first = newGame(ctx, { seed, start: start as Extract<PlayAction, { t: "start" }> });
  if (!first.ok) return { state: sampleState(ctx, seed), steps: 0, death: null };
  let state = first.state;
  let steps = 0;
  const triggerScenes = new Set([...ctx.resources.values()].map((resource) => resource.onZero?.sceneId).filter(Boolean));
  let death: string | null = null;

  while (steps < MAX_STEPS) {
    steps += 1;
    const step = nextStep(ctx, state);
    let action: PlayAction | null = null;
    if (step.kind === "choices") {
      const enabled = step.choices.filter((view) => view.enabled);
      if (enabled.length === 0) break;
      action = { t: "choose", choiceId: pick(enabled, seed, counter++).choice.id };
    } else if (step.kind === "next-chapter") action = { t: "continue" };
    else if (step.kind === "overflow") action = { t: "discard" };
    else if (step.kind === "combat") {
      if (step.mode === "single") action = { t: "combat", action: "single" };
      else {
        const actions = ctx.system.combat.actions.map((entry) => entry.key);
        action = { t: "combat", action: actions.length > 0 ? pick(actions, seed, counter++) : "defend" };
      }
    } else break;
    // Pontos de nível: distribui no primeiro atributo que der.
    if (ctx.on("progression") && num(state.vars[ctx.system.progression.pointsKey]) > 0) {
      for (const attribute of ctx.attributes.values()) {
        const allocated = applyAction(ctx, state, { t: "allocate", key: attribute.key });
        if (allocated.ok) {
          state = allocated.state;
          break;
        }
      }
    }
    const before = state.sceneId;
    const result = applyAction(ctx, state, action);
    if (!result.ok) {
      // Ação de combate recusada (sem recurso): tenta defender, senão para.
      if (action.t === "combat" && action.action !== "defend") {
        const fallback = applyAction(ctx, state, { t: "combat", action: "defend" });
        if (fallback.ok) {
          state = fallback.state;
          continue;
        }
      }
      break;
    }
    state = result.state;
    if (triggerScenes.has(state.sceneId) && state.sceneId !== before && !death) death = before;
  }
  return { state, steps, death };
}

export function simulateRuns(ctx: GameContext, runs: number, seedPrefix = "sim"): RunSummary {
  const summary: RunSummary = { runs: 0, endings: new Map(), stuck: new Map(), deaths: new Map(), visited: new Map(), averageSteps: 0 };
  let totalSteps = 0;
  for (let index = 0; index < runs; index += 1) {
    const { state, steps, death } = simulateRun(ctx, `${seedPrefix}-${index}`);
    summary.runs += 1;
    totalSteps += steps;
    const scene = ctx.scenes.get(state.sceneId);
    if (scene?.isEnding) summary.endings.set(scene.id, (summary.endings.get(scene.id) ?? 0) + 1);
    else if (state.sceneId) summary.stuck.set(state.sceneId, (summary.stuck.get(state.sceneId) ?? 0) + 1);
    if (death) summary.deaths.set(death, (summary.deaths.get(death) ?? 0) + 1);
    for (const sceneId of new Set(state.path)) summary.visited.set(sceneId, (summary.visited.get(sceneId) ?? 0) + 1);
  }
  summary.averageSteps = summary.runs > 0 ? Math.round((totalSteps / summary.runs) * 10) / 10 : 0;
  return summary;
}

// ------------------------------------------------------------------ build pura x equilibrada

export type BuildPoint = { level: number; pure: number; balanced: number };

// Personagem no nível pedido com os pontos gastos de um jeito: tudo no primeiro atributo (pura)
// ou um ponto em cada, em rodízio (equilibrada). Custo crescente e teto valem.
function buildAt(ctx: GameContext, level: number, strategy: "pure" | "balanced"): GameState {
  const state = sampleState(ctx, `build-${strategy}-${level}`);
  const progression = ctx.system.progression;
  state.vars[progression.xpKey] = xpForLevel(ctx, level);
  state.level = level;
  let points = progression.pointsPerLevel * (level - 1) + (ctx.on("character") ? ctx.system.character.startingPoints : 0);
  const stats = [...ctx.attributes.values()].filter((attribute) => attribute.kind === "stat");
  let turn = 0;
  let guard = 0;
  while (points > 0 && stats.length > 0 && guard < 2000) {
    guard += 1;
    const attribute = strategy === "pure" ? stats[0] : stats[turn % stats.length];
    turn += 1;
    const value = num(state.vars[attribute.key]);
    const cost = pointCost(ctx, value);
    if (cost > points || value + 1 > attributeCap(ctx, state, attribute.key)) {
      if (strategy === "pure") break;
      if (turn > stats.length * 50) break;
      continue;
    }
    points -= cost;
    state.vars[attribute.key] = value + 1;
  }
  for (const resource of ctx.resources.values()) state.vars[resource.key] = 1_000_000;
  return state;
}

// Dano médio por rodada da primeira ação de combate contra a primeira criatura, por nível.
export function compareBuilds(ctx: GameContext, maxLevel = 10, samples = 60): BuildPoint[] {
  const action = ctx.system.combat.actions[0];
  const creature = [...ctx.creatures.values()][0];
  if (!action || !creature) return [];
  const scene = {
    id: "__sim__",
    chapterId: "",
    label: "",
    blocks: [],
    isEnding: false,
    endingTitle: {},
    effects: [],
    graphX: 0,
    graphY: 0,
    mechanics: {
      kind: "encounter" as const,
      onZero: {},
      noRegen: true,
      shop: null,
      encounter: { creatures: [{ creatureId: creature.id, count: 1 }], mode: "rounds" as const, victorySceneId: null, defeatSceneId: null, fleeSceneId: null, single: { roll: "0", dc: "0", hpLoss: "0" } },
    },
  };
  const damage = (base: GameState): number => {
    let total = 0;
    for (let sample = 0; sample < samples; sample += 1) {
      const draft = cloneState(base);
      draft.seed = `${base.seed}-${sample}`;
      draft.counter = 0;
      startCombat(ctx, draft, scene);
      if (!draft.combat) return 0;
      draft.combat.creatures[0].hp = 1_000_000_000;
      const before = draft.combat.creatures[0].hp;
      combatRound(ctx, draft, { action: action.key, target: 0 });
      total += before - (draft.combat?.creatures[0]?.hp ?? before);
    }
    return Math.round((total / samples) * 10) / 10;
  };
  const top = Math.max(1, Math.min(maxLevel, ctx.on("progression") ? ctx.system.progression.maxLevel : 1));
  const points: BuildPoint[] = [];
  for (let level = 1; level <= top; level += 1) {
    points.push({ level, pure: damage(buildAt(ctx, level, "pure")), balanced: damage(buildAt(ctx, level, "balanced")) });
  }
  return points;
}
