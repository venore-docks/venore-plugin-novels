import type { Condition, Effect, GameSystem, Item, ResourceDef } from "../contracts/game";
import type { ChoiceCondition, ChoiceRecord, SceneRecord, VariableDefinition, VariableEffect } from "../contracts/types";
import { emptyItemFields } from "./game-input";

// Migração das variáveis antigas para o modelo novo (seções 7.3 e 10.3 do documento), sob demanda
// pelo autor na aba Sistema: número com exibição "status" e teto vira recurso (barra); variável de
// inventário vira item do catálogo (peso mantido) e os efeitos/condições que a usavam passam a
// dar/tirar/conferir o item; a capacidade vira o peso máximo. Pura: o service grava o resultado.

export type ConversionPlan = {
  variables: VariableDefinition[];
  system: GameSystem;
  items: Omit<Item, "id" | "position">[];
  scenes: { id: string; effects: Effect[] }[];
  choices: { id: string; conditions: Condition[]; effects: Effect[] }[];
  // Itens que o leitor já tinha no começo: viram efeito na primeira cena.
  startingItems: { key: string; quantity: number }[];
  summary: { resources: string[]; items: string[]; capacity: string | null };
};

const isLegacyEffect = (effect: Effect): effect is VariableEffect => !("kind" in effect) || effect.kind === undefined;
const isLegacyCondition = (condition: Condition): condition is ChoiceCondition => !("kind" in condition) || condition.kind === undefined;

export function canConvert(variables: VariableDefinition[]): boolean {
  return variables.some((variable) => isResourceVariable(variable, variables) || variable.display === "inventory" || variable.capacity);
}

function isResourceVariable(variable: VariableDefinition, all: VariableDefinition[]): boolean {
  if (variable.type !== "number" || variable.display !== "status") return false;
  if (typeof variable.max === "number") return true;
  return Boolean(variable.maxVariable && all.some((candidate) => candidate.key === variable.maxVariable));
}

export function planLegacyConversion(input: {
  variables: VariableDefinition[];
  system: GameSystem;
  locale: string;
  existingItemKeys: string[];
  scenes: Pick<SceneRecord, "id" | "effects">[];
  choices: Pick<ChoiceRecord, "id" | "conditions" | "effects">[];
}): ConversionPlan {
  const { variables, locale } = input;
  const system: GameSystem = structuredClone(input.system);
  const resourceVars = variables.filter((variable) => isResourceVariable(variable, variables));
  const itemVars = variables.filter((variable) => variable.display === "inventory" && !input.existingItemKeys.includes(variable.key));
  const capacity = variables.find((variable) => variable.capacity && variable.type === "number") ?? null;

  const resources: ResourceDef[] = resourceVars
    .filter((variable) => !system.resources.some((resource) => resource.key === variable.key))
    .map((variable) => ({
      key: variable.key,
      name: { [locale]: variable.label || variable.key },
      abbr: { [locale]: (variable.label || variable.key).slice(0, 4) },
      color: "chart-2",
      max: variable.maxVariable ?? String(variable.max),
      initial: String(variable.initial),
      regen: "",
      regenInCombat: false,
      onZero: null,
      onFull: null,
      showInHud: true,
      lowPercent: 25,
    }));
  if (resources.length > 0) {
    system.modules.resources = true;
    system.resources = [...system.resources, ...resources];
  }

  const items: Omit<Item, "id" | "position">[] = itemVars.map((variable) => ({
    ...emptyItemFields(),
    key: variable.key,
    name: { [locale]: variable.label || variable.key },
    weight: typeof variable.weight === "number" ? variable.weight : 0,
    stackable: variable.type === "number",
    maxStack: variable.type === "number" ? 999 : 1,
  }));
  if (items.length > 0) system.modules.inventory = true;
  if (capacity) {
    system.modules.inventory = true;
    system.inventory = { ...system.inventory, weight: { ...system.inventory.weight, enabled: true, max: capacity.key, overLimit: "penalty", penalty: [] } };
  }

  const itemKeys = new Map(itemVars.map((variable) => [variable.key, variable]));
  // As referências usam a chave do item; o service troca pelo id depois de criar.
  const effect = (current: Effect): Effect[] => {
    if (!isLegacyEffect(current)) return [current];
    const variable = itemKeys.get(current.variable);
    if (!variable) return [current];
    const ref = `key:${variable.key}`;
    if (variable.type === "boolean") {
      if (current.operation === "toggle" || current.value === true) return [{ kind: "item", operation: "give", itemId: ref, quantity: "1" }];
      return [{ kind: "item", operation: "take", itemId: ref, quantity: "1" }];
    }
    const amount = typeof current.value === "number" ? current.value : 0;
    if (current.operation === "add") return amount === 0 ? [] : [{ kind: "item", operation: amount > 0 ? "give" : "take", itemId: ref, quantity: String(Math.abs(amount)) }];
    // "definir como N": tira tudo e dá N.
    return [
      { kind: "item", operation: "take", itemId: ref, quantity: "999999" },
      ...(amount > 0 ? [{ kind: "item" as const, operation: "give" as const, itemId: ref, quantity: String(amount) }] : []),
    ];
  };
  const condition = (current: Condition): Condition => {
    if (!isLegacyCondition(current)) return current;
    const variable = itemKeys.get(current.variable);
    if (!variable) return current;
    const has = `tem("${variable.key}")`;
    if (variable.type === "boolean") {
      const wants = (current.operator === "eq") === (current.value === true);
      return wants ? { kind: "item", itemId: `key:${variable.key}`, min: 1 } : { kind: "formula", formula: `${has} = 0` };
    }
    if (current.operator === "gte" && typeof current.value === "number" && current.value >= 1) return { kind: "item", itemId: `key:${variable.key}`, min: current.value };
    const ops: Record<string, string> = { eq: "=", neq: "!=", gt: ">", gte: ">=", lt: "<", lte: "<=" };
    return { kind: "formula", formula: `${has} ${ops[current.operator]} ${Number(current.value)}` };
  };

  const scenes = input.scenes
    .map((scene) => ({ id: scene.id, effects: scene.effects.flatMap(effect), changed: scene.effects.some((entry) => isLegacyEffect(entry) && itemKeys.has(entry.variable)) }))
    .filter((scene) => scene.changed)
    .map(({ id, effects }) => ({ id, effects }));
  const choices = input.choices
    .map((choice) => ({
      id: choice.id,
      conditions: choice.conditions.map(condition),
      effects: choice.effects.flatMap(effect),
      changed: choice.effects.some((entry) => isLegacyEffect(entry) && itemKeys.has(entry.variable)) || choice.conditions.some((entry) => isLegacyCondition(entry) && itemKeys.has(entry.variable)),
    }))
    .filter((choice) => choice.changed)
    .map(({ id, conditions, effects }) => ({ id, conditions, effects }));

  const startingItems = itemVars
    .map((variable) => ({ key: variable.key, quantity: variable.type === "boolean" ? (variable.initial === true ? 1 : 0) : Math.max(0, Number(variable.initial) || 0) }))
    .filter((entry) => entry.quantity > 0);

  const removed = new Set([...resourceVars.map((variable) => variable.key), ...itemVars.map((variable) => variable.key)]);
  return {
    variables: variables.filter((variable) => !removed.has(variable.key)).map((variable) => (variable.capacity ? { ...variable, capacity: undefined, display: "hidden" as const } : variable)),
    system,
    items,
    scenes,
    choices,
    startingItems,
    summary: { resources: resources.map((resource) => resource.key), items: items.map((item) => item.key), capacity: capacity?.key ?? null },
  };
}

// Troca as referências "key:chave" pelos ids dos itens criados.
export function resolveItemRefs<T>(value: T, ids: Map<string, string>): T {
  return JSON.parse(JSON.stringify(value), (key, field) => (key === "itemId" && typeof field === "string" && field.startsWith("key:") ? (ids.get(field.slice(4)) ?? field) : field)) as T;
}
