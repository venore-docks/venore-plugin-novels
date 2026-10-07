import type { VariableDefinition, VariableValue } from "../contracts/types";

// Regras das variáveis que aparecem para o leitor (painel do personagem): limites, inventário e
// carga. Puro: roda no leitor (client), no motor e no validador.

// Valores calculados que as condições podem usar, como se fossem variáveis: começam com "_" para
// nunca colidir com uma chave do autor (que começa por letra).
export const LOAD_KEY = "_carga";
export const FREE_CAPACITY_KEY = "_espaco_livre";

const isInventory = (definition: VariableDefinition) => definition.display === "inventory";

export function capacityVariable(variables: VariableDefinition[]): VariableDefinition | null {
  return variables.find((variable) => variable.capacity && variable.type === "number") ?? null;
}

// Peso que um item ocupa agora: sim/não pesa uma unidade se carregado; número pesa por unidade.
function itemLoad(definition: VariableDefinition, value: VariableValue | undefined): number {
  const weight = typeof definition.weight === "number" && definition.weight >= 0 ? definition.weight : 1;
  if (typeof value === "boolean") return value ? weight : 0;
  return typeof value === "number" && value > 0 ? value * weight : 0;
}

export function inventoryLoad(vars: Record<string, VariableValue>, variables: VariableDefinition[]): number {
  const total = variables.filter(isInventory).reduce((sum, definition) => sum + itemLoad(definition, vars[definition.key]), 0);
  return Math.round(total * 100) / 100;
}

// Definições dos valores calculados, para o editor de condições e o validador. Só existem quando a
// obra tem inventário (e espaço livre só com uma capacidade declarada).
export function derivedVariables(variables: VariableDefinition[]): VariableDefinition[] {
  if (!variables.some(isInventory)) return [];
  const derived: VariableDefinition[] = [{ key: LOAD_KEY, label: "Carga do inventário", type: "number", initial: 0 }];
  if (capacityVariable(variables)) {
    derived.push({ key: FREE_CAPACITY_KEY, label: "Espaço livre no inventário", type: "number", initial: 0 });
  }
  return derived;
}

// Variáveis do autor mais os valores calculados, para avaliar condições.
export function withDerivedValues(
  vars: Record<string, VariableValue>,
  variables: VariableDefinition[],
): Record<string, VariableValue> {
  if (!variables.some(isInventory)) return vars;
  const load = inventoryLoad(vars, variables);
  const capacity = capacityVariable(variables);
  const next: Record<string, VariableValue> = { ...vars, [LOAD_KEY]: load };
  if (capacity) {
    const cap = vars[capacity.key];
    next[FREE_CAPACITY_KEY] = Math.round(((typeof cap === "number" ? cap : 0) - load) * 100) / 100;
  }
  return next;
}

// Teto efetivo de um número: outra variável (maxVariable) ou o valor fixo (max).
export function upperBound(definition: VariableDefinition, vars: Record<string, VariableValue>): number | null {
  if (definition.maxVariable) {
    const value = vars[definition.maxVariable];
    return typeof value === "number" ? value : null;
  }
  return typeof definition.max === "number" ? definition.max : null;
}

export function clampNumber(definition: VariableDefinition, value: number, vars: Record<string, VariableValue>): number {
  let next = value;
  const max = upperBound(definition, vars);
  if (max !== null) next = Math.min(next, max);
  if (typeof definition.min === "number") next = Math.max(next, definition.min);
  return next;
}

// Reaplica os limites de todos os números (o teto de um pode ter mudado: hp_max subiu).
export function clampAll(vars: Record<string, VariableValue>, variables: VariableDefinition[]): Record<string, VariableValue> {
  let next = vars;
  for (const definition of variables) {
    const value = next[definition.key];
    if (definition.type !== "number" || typeof value !== "number") continue;
    const clamped = clampNumber(definition, value, next);
    if (clamped !== value) next = { ...next, [definition.key]: clamped };
  }
  return next;
}

// ------------------------------------------------------------------ painel do leitor

export type StatusEntry = { key: string; label: string; value: number | boolean; max: number | null };
export type InventoryEntry = { key: string; label: string; quantity: number | null; weight: number };
export type CharacterSheet = {
  status: StatusEntry[];
  skills: StatusEntry[];
  inventory: InventoryEntry[];
  hasInventory: boolean;
  load: number;
  capacity: number | null;
};

export function characterSheet(vars: Record<string, VariableValue>, variables: VariableDefinition[]): CharacterSheet {
  const entry = (definition: VariableDefinition): StatusEntry => ({
    key: definition.key,
    label: definition.label || definition.key,
    value: vars[definition.key] ?? definition.initial,
    max: definition.type === "number" ? upperBound(definition, vars) : null,
  });
  const inventory: InventoryEntry[] = [];
  for (const definition of variables.filter(isInventory)) {
    const value = vars[definition.key] ?? definition.initial;
    const carried = typeof value === "boolean" ? value : value > 0;
    if (!carried) continue;
    inventory.push({
      key: definition.key,
      label: definition.label || definition.key,
      quantity: typeof value === "number" ? value : null,
      weight: itemLoad(definition, value),
    });
  }
  const capacity = capacityVariable(variables);
  const capValue = capacity ? vars[capacity.key] : undefined;
  return {
    // A capacidade aparece só na mochila (peso máximo), nunca como status solto ("Cap 400").
    status: variables.filter((variable) => variable.display === "status" && !variable.capacity).map(entry),
    skills: variables.filter((variable) => variable.display === "skill" && !variable.capacity).map(entry),
    inventory,
    hasInventory: variables.some(isInventory),
    load: inventoryLoad(vars, variables),
    capacity: typeof capValue === "number" ? capValue : null,
  };
}

export function hasCharacterSheet(variables: VariableDefinition[]): boolean {
  return variables.some((variable) => (variable.display && variable.display !== "hidden") || variable.capacity);
}

export type VariableChange = { key: string; text: string; tone: "up" | "down" | "neutral" };

// A interface do plugin é pt-BR: decimal com vírgula ("28,6"), até duas casas.
const NUMBER_FORMAT = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });
const formatNumber = (value: number) => NUMBER_FORMAT.format(value);

// O que mudou entre dois estados, só nas variáveis visíveis ao leitor: "Club fighting +1",
// "HP −12", "Pegou: Clava", "Largou: Clava", "Poção de vida +2".
export function describeChanges(
  before: Record<string, VariableValue>,
  after: Record<string, VariableValue>,
  variables: VariableDefinition[],
): VariableChange[] {
  const changes: VariableChange[] = [];
  for (const definition of variables) {
    if (!definition.display || definition.display === "hidden") continue;
    const from = before[definition.key] ?? definition.initial;
    const to = after[definition.key] ?? definition.initial;
    if (from === to) continue;
    const label = definition.label || definition.key;
    if (typeof from === "number" && typeof to === "number") {
      const delta = to - from;
      changes.push({ key: definition.key, text: `${label} ${delta > 0 ? "+" : "−"}${formatNumber(Math.abs(delta))}`, tone: delta > 0 ? "up" : "down" });
    } else if (definition.display === "inventory") {
      changes.push({ key: definition.key, text: `${to ? "Pegou" : "Largou"}: ${label}`, tone: to ? "up" : "down" });
    } else {
      changes.push({ key: definition.key, text: `${label}: ${to ? "sim" : "não"}`, tone: "neutral" });
    }
  }
  return changes;
}

export { formatNumber };

// Grava só os campos conhecidos (o formulário manda JSON do client): exibição "hidden" e campos
// vazios não são guardados, então obra sem painel continua com o mesmo JSON de antes.
export function sanitizeVariable(variable: VariableDefinition): VariableDefinition {
  const clean: VariableDefinition = {
    key: variable.key,
    label: variable.label.trim() || variable.key,
    type: variable.type,
    initial: variable.initial,
  };
  if (variable.display && variable.display !== "hidden") clean.display = variable.display;
  if (variable.type === "number") {
    if (typeof variable.min === "number" && Number.isFinite(variable.min)) clean.min = variable.min;
    if (variable.maxVariable) clean.maxVariable = variable.maxVariable;
    else if (typeof variable.max === "number" && Number.isFinite(variable.max)) clean.max = variable.max;
    if (variable.capacity === true) clean.capacity = true;
  }
  if (clean.display === "inventory" && typeof variable.weight === "number" && Number.isFinite(variable.weight)) {
    clean.weight = variable.weight;
  }
  return clean;
}
