import type {
  ChoiceCondition,
  ChoiceRecord,
  ReaderState,
  Story,
  StoryScene,
  VariableDefinition,
  VariableEffect,
  VariableValue,
} from "../contracts/types";
import { clampAll, clampNumber, withDerivedValues } from "./variables";

// Motor de leitura: função pura sobre o grafo da obra, sem React nem banco. Roda no client (o
// leitor) e é a mesma regra que o validador de publicação usa pra saber o que é alcançável.

export const MAX_PATH_LENGTH = 500;

export type StoryIndex = {
  scenesById: Map<string, StoryScene>;
  choicesBySceneId: Map<string, ChoiceRecord[]>;
  variablesByKey: Map<string, VariableDefinition>;
};

export function indexStory(story: Pick<Story, "scenes" | "choices" | "work">): StoryIndex {
  const scenesById = new Map(story.scenes.map((scene) => [scene.id, scene]));
  const choicesBySceneId = new Map<string, ChoiceRecord[]>();
  for (const choice of story.choices) {
    const list = choicesBySceneId.get(choice.sceneId) ?? [];
    list.push(choice);
    choicesBySceneId.set(choice.sceneId, list);
  }
  for (const list of choicesBySceneId.values()) list.sort((a, b) => a.position - b.position);
  const variablesByKey = new Map(story.work.variables.map((variable) => [variable.key, variable]));
  return { scenesById, choicesBySceneId, variablesByKey };
}

export function initialVariables(variables: VariableDefinition[]): Record<string, VariableValue> {
  return clampAll(Object.fromEntries(variables.map((variable) => [variable.key, variable.initial])), variables);
}

export function evaluateCondition(condition: ChoiceCondition, vars: Record<string, VariableValue>): boolean {
  const current = vars[condition.variable];
  if (current === undefined) return false;
  switch (condition.operator) {
    case "eq":
      return current === condition.value;
    case "neq":
      return current !== condition.value;
    case "gt":
      return typeof current === "number" && typeof condition.value === "number" && current > condition.value;
    case "gte":
      return typeof current === "number" && typeof condition.value === "number" && current >= condition.value;
    case "lt":
      return typeof current === "number" && typeof condition.value === "number" && current < condition.value;
    case "lte":
      return typeof current === "number" && typeof condition.value === "number" && current <= condition.value;
  }
}

// `variables` liga os valores calculados (carga e espaço livre do inventário) nas condições.
export function isChoiceAvailable(
  choice: ChoiceRecord,
  vars: Record<string, VariableValue>,
  variables: VariableDefinition[] = [],
): boolean {
  const values = withDerivedValues(vars, variables);
  return choice.conditions.every((condition) => evaluateCondition(condition, values));
}

// Efeito sobre variável não declarada (ou de tipo errado) é ignorado em silêncio na leitura: o
// validador de publicação já barra isso antes, então aqui só protege contra estado antigo salvo
// antes de o autor apagar uma variável.
export function applyEffects(
  vars: Record<string, VariableValue>,
  effects: VariableEffect[],
  variablesByKey: Map<string, VariableDefinition>,
): Record<string, VariableValue> {
  const next = { ...vars };
  for (const effect of effects) {
    const definition = variablesByKey.get(effect.variable);
    if (!definition) continue;
    const current = next[effect.variable] ?? definition.initial;
    if (effect.operation === "set" && typeof effect.value === typeof definition.initial) {
      next[effect.variable] = effect.value;
    } else if (effect.operation === "add" && typeof current === "number" && typeof effect.value === "number") {
      next[effect.variable] = current + effect.value;
    } else if (effect.operation === "toggle" && typeof current === "boolean") {
      next[effect.variable] = !current;
    }
    const value = next[effect.variable];
    if (typeof value === "number") next[effect.variable] = clampNumber(definition, value, next);
  }
  // Um teto pode ter mudado (hp_max subiu ou desceu): reaplica os limites de todos os números.
  return clampAll(next, [...variablesByKey.values()]);
}

function enterScene(index: StoryIndex, state: Omit<ReaderState, "sceneId">, sceneId: string): ReaderState {
  const scene = index.scenesById.get(sceneId);
  const vars = scene ? applyEffects(state.vars, scene.effects, index.variablesByKey) : state.vars;
  const path = [...state.path, sceneId].slice(-MAX_PATH_LENGTH);
  const visitedEndings =
    scene?.isEnding && !state.visitedEndings.includes(sceneId) ? [...state.visitedEndings, sceneId] : state.visitedEndings;
  return { sceneId, vars, path, visitedEndings };
}

export function firstSceneId(story: Pick<Story, "chapters">): string | null {
  const ordered = [...story.chapters].sort((a, b) => a.position - b.position);
  return ordered.find((chapter) => chapter.startSceneId)?.startSceneId ?? null;
}

// Nova partida. Preserva os finais já descobertos (visitedEndings) de partidas anteriores.
export function startStory(story: Story, index: StoryIndex, visitedEndings: string[] = []): ReaderState | null {
  const start = firstSceneId(story);
  if (!start || !index.scenesById.has(start)) return null;
  return enterScene(index, { vars: initialVariables(story.work.variables), path: [], visitedEndings }, start);
}

export type NextStep =
  | { kind: "choices"; choices: ChoiceRecord[] }
  | { kind: "next-chapter"; chapterId: string; sceneId: string }
  | { kind: "ending"; scene: StoryScene }
  | { kind: "dead-end" };

// O que vem depois da cena atual. Cena sem escolha e sem ser final avança pro início do próximo
// capítulo (fim de capítulo); no último capítulo, isso é um beco sem saída que o validador
// aponta antes de publicar.
export function nextStep(story: Story, index: StoryIndex, state: ReaderState): NextStep {
  const scene = index.scenesById.get(state.sceneId);
  if (!scene) return { kind: "dead-end" };
  if (scene.isEnding) return { kind: "ending", scene };

  const sceneChoices = index.choicesBySceneId.get(scene.id) ?? [];
  if (sceneChoices.length > 0) {
    const variables = [...index.variablesByKey.values()];
    const available = sceneChoices.filter((choice) => isChoiceAvailable(choice, state.vars, variables));
    return available.length > 0 ? { kind: "choices", choices: available } : { kind: "dead-end" };
  }

  const nextChapter = followingChapter(story, scene.chapterId);
  if (nextChapter?.startSceneId && index.scenesById.has(nextChapter.startSceneId)) {
    return { kind: "next-chapter", chapterId: nextChapter.id, sceneId: nextChapter.startSceneId };
  }
  return { kind: "dead-end" };
}

export function followingChapter(story: Pick<Story, "chapters">, chapterId: string) {
  const ordered = [...story.chapters].sort((a, b) => a.position - b.position);
  const position = ordered.findIndex((chapter) => chapter.id === chapterId);
  return position >= 0 ? (ordered[position + 1] ?? null) : null;
}

export type AdvanceResult = { ok: true; state: ReaderState } | { ok: false; reason: "choice_unavailable" | "no_next_chapter" };

export function choose(story: Story, index: StoryIndex, state: ReaderState, choiceId: string): AdvanceResult {
  const step = nextStep(story, index, state);
  if (step.kind !== "choices") return { ok: false, reason: "choice_unavailable" };
  const choice = step.choices.find((candidate) => candidate.id === choiceId);
  if (!choice || !index.scenesById.has(choice.targetSceneId)) return { ok: false, reason: "choice_unavailable" };
  const vars = applyEffects(state.vars, choice.effects, index.variablesByKey);
  return { ok: true, state: enterScene(index, { ...state, vars }, choice.targetSceneId) };
}

export function continueToNextChapter(story: Story, index: StoryIndex, state: ReaderState): AdvanceResult {
  const step = nextStep(story, index, state);
  if (step.kind !== "next-chapter") return { ok: false, reason: "no_next_chapter" };
  return { ok: true, state: enterScene(index, state, step.sceneId) };
}

// Estado salvo (localStorage ou banco) pode ser de uma versão antiga da obra: cena apagada,
// variável removida. Em vez de quebrar, o leitor recomeça preservando os finais descobertos.
export function reconcileState(story: Story, index: StoryIndex, saved: ReaderState | null): ReaderState | null {
  if (saved && index.scenesById.has(saved.sceneId)) {
    const vars = { ...initialVariables(story.work.variables) };
    for (const [key, value] of Object.entries(saved.vars ?? {})) {
      const definition = index.variablesByKey.get(key);
      if (definition && typeof value === typeof definition.initial) vars[key] = value;
    }
    const path = (saved.path ?? []).filter((sceneId) => index.scenesById.has(sceneId)).slice(-MAX_PATH_LENGTH);
    const visitedEndings = (saved.visitedEndings ?? []).filter((sceneId) => index.scenesById.get(sceneId)?.isEnding);
    return { sceneId: saved.sceneId, vars, path: path.length > 0 ? path : [saved.sceneId], visitedEndings };
  }
  const endings = (saved?.visitedEndings ?? []).filter((sceneId) => index.scenesById.get(sceneId)?.isEnding);
  return startStory(story, index, endings);
}

// Voltar para a última escolha: corta o path até a cena anterior que tinha escolhas e refaz o
// estado das variáveis do zero, reaplicando os efeitos do caminho restante. Recalcular (em vez
// de guardar um snapshot por passo) mantém o estado salvo pequeno.
export function undoLastChoice(story: Story, index: StoryIndex, state: ReaderState): ReaderState | null {
  const decisionIndex = findLastDecisionIndex(index, state.path);
  if (decisionIndex < 0) return null;
  const truncated = state.path.slice(0, decisionIndex + 1);
  return replayPath(story, index, truncated, state.visitedEndings);
}

function findLastDecisionIndex(index: StoryIndex, path: string[]): number {
  for (let position = path.length - 2; position >= 0; position -= 1) {
    if ((index.choicesBySceneId.get(path[position])?.length ?? 0) > 0) return position;
  }
  return -1;
}

export function replayPath(story: Story, index: StoryIndex, path: string[], visitedEndings: string[]): ReaderState | null {
  if (path.length === 0) return null;
  let state: ReaderState = enterScene(
    index,
    { vars: initialVariables(story.work.variables), path: [], visitedEndings },
    path[0],
  );
  for (const sceneId of path.slice(1)) {
    const choice = (index.choicesBySceneId.get(state.sceneId) ?? []).find((candidate) => candidate.targetSceneId === sceneId);
    const vars = choice ? applyEffects(state.vars, choice.effects, index.variablesByKey) : state.vars;
    state = enterScene(index, { ...state, vars }, sceneId);
  }
  return state;
}

// Valor das variáveis depois de cada cena do caminho (mesmo replay de replayPath): o leitor
// compara cena a cena para mostrar o que mudou ("Club fighting +1", "Pegou: Clava").
export function varsAlongPath(story: Story, index: StoryIndex, path: string[]): Record<string, VariableValue>[] {
  const result: Record<string, VariableValue>[] = [];
  if (path.length === 0) return result;
  let state: ReaderState = enterScene(index, { vars: initialVariables(story.work.variables), path: [], visitedEndings: [] }, path[0]);
  result.push(state.vars);
  for (const sceneId of path.slice(1)) {
    const choice = (index.choicesBySceneId.get(state.sceneId) ?? []).find((candidate) => candidate.targetSceneId === sceneId);
    const vars = choice ? applyEffects(state.vars, choice.effects, index.variablesByKey) : state.vars;
    state = enterScene(index, { ...state, vars }, sceneId);
    result.push(state.vars);
  }
  return result;
}
