import { TEMPLATE_FORMAT, type Creature, type GameSystem, type Item, type SystemTemplatePackage } from "../../contracts/game";
import type { LocalizedText, VariableDefinition } from "../../contracts/types";
import { normalizeSystem } from "../engine/system";
import { creatureFieldsError, GAME_LIMITS, isGameKey, itemFieldsError, sanitizeCreatureFields, sanitizeItemFields } from "../game-input";
import { validateVariableDefinitions } from "../story-validation";
import { sanitizeVariable } from "../variables";

// Pacote de modelo de sistema (como os plugins: um arquivo que se importa no Graphic Novels). Dentro
// do pacote, item e criatura são referenciados pela chave; na obra, pelo id. Cena não viaja no
// pacote (cada obra tem as suas): gatilho "ao zerar → cena" volta vazio para o autor escolher.

const SCENE_FIELDS = new Set(["sceneId", "targetSceneId", "victorySceneId", "defeatSceneId", "fleeSceneId"]);
const MAX_PACKAGE_CHARS = 400_000;

type RefMaps = { items: Map<string, string>; creatures: Map<string, string> };

// Troca as referências de item/criatura (itemId, creatureId) pelo mapa e apaga as de cena.
export function remapRefs<T>(value: T, maps: RefMaps): T {
  const walk = (current: unknown): unknown => {
    if (Array.isArray(current)) return current.map(walk);
    if (!current || typeof current !== "object") return current;
    const next: Record<string, unknown> = {};
    for (const [key, field] of Object.entries(current as Record<string, unknown>)) {
      if (key === "itemId" && typeof field === "string") next[key] = maps.items.get(field) ?? field;
      else if (key === "creatureId" && typeof field === "string") next[key] = maps.creatures.get(field) ?? field;
      else if (SCENE_FIELDS.has(key) && (typeof field === "string" || field === null)) next[key] = null;
      else if (key === "previousWorkId") next[key] = null;
      else next[key] = walk(field);
    }
    return next;
  };
  return walk(value) as T;
}

export type WorkSystemSource = {
  system: GameSystem;
  variables: VariableDefinition[];
  items: Item[];
  creatures: Creature[];
};

// Pacote a partir do sistema de uma obra (exportar, ou "salvar como modelo").
export function packageFromWork(
  source: WorkSystemSource,
  meta: { key: string; name: LocalizedText; description: LocalizedText },
): SystemTemplatePackage {
  const maps: RefMaps = {
    items: new Map(source.items.map((item) => [item.id, item.key])),
    creatures: new Map(source.creatures.map((creature) => [creature.id, creature.key])),
  };
  return {
    format: TEMPLATE_FORMAT,
    version: 1,
    key: meta.key,
    name: meta.name,
    description: meta.description,
    system: remapRefs(source.system, maps),
    variables: source.variables,
    items: source.items.map((item) => remapRefs({ ...item, id: item.key }, maps)),
    creatures: source.creatures.map((creature) => remapRefs({ ...creature, id: creature.key }, maps)),
  };
}

export type ParsedPackage = { ok: true; value: SystemTemplatePackage } | { ok: false; message: string };

const isObject = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);

function localized(value: unknown, max: number): LocalizedText {
  if (!isObject(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .filter((entry): entry is [string, string] => typeof entry[1] === "string")
      .map(([locale, content]) => [locale.slice(0, 10), content.trim().slice(0, max)])
      .filter(([, content]) => content),
  );
}

// Lê um pacote vindo de fora (arquivo importado, banco): formato, limites e campos conhecidos.
export function parsePackage(raw: unknown): ParsedPackage {
  let value = raw;
  if (typeof raw === "string") {
    if (raw.length > MAX_PACKAGE_CHARS) return { ok: false, message: "Arquivo grande demais para um modelo." };
    try {
      value = JSON.parse(raw);
    } catch {
      return { ok: false, message: "O arquivo não é um JSON válido." };
    }
  }
  if (!isObject(value) || value.format !== TEMPLATE_FORMAT) return { ok: false, message: "Esse arquivo não é um modelo de sistema do Graphic Novels." };
  if (value.version !== 1) return { ok: false, message: "Versão de modelo que esta instalação ainda não conhece." };
  const key = typeof value.key === "string" ? value.key.trim() : "";
  if (!isGameKey(key)) return { ok: false, message: "Chave do modelo inválida (letras minúsculas, números e _)." };
  const name = localized(value.name, 80);
  if (Object.keys(name).length === 0) return { ok: false, message: "O modelo precisa de um nome." };

  const variables = (Array.isArray(value.variables) ? value.variables : []).slice(0, 50).map((variable) => sanitizeVariable(variable as VariableDefinition));
  const variableIssue = validateVariableDefinitions(variables)[0];
  if (variableIssue) return { ok: false, message: `Variáveis do modelo: ${variableIssue.message}` };

  const rawItems = Array.isArray(value.items) ? value.items : [];
  const rawCreatures = Array.isArray(value.creatures) ? value.creatures : [];
  if (rawItems.length > GAME_LIMITS.items || rawCreatures.length > GAME_LIMITS.creatures) return { ok: false, message: "Modelo com itens ou criaturas demais." };
  const items: Item[] = [];
  for (const [position, rawItem] of rawItems.entries()) {
    const fields = sanitizeItemFields(rawItem);
    const locale = Object.keys(fields.name)[0] ?? "";
    const problem = itemFieldsError(fields, locale);
    if (problem) return { ok: false, message: `Item ${position + 1}: ${problem}` };
    if (items.some((item) => item.key === fields.key)) return { ok: false, message: `Item "${fields.key}" repetido.` };
    items.push({ ...fields, id: fields.key, position });
  }
  const creatures: Creature[] = [];
  for (const [position, rawCreature] of rawCreatures.entries()) {
    const fields = sanitizeCreatureFields(rawCreature);
    const locale = Object.keys(fields.name)[0] ?? "";
    const problem = creatureFieldsError(fields, locale);
    if (problem) return { ok: false, message: `Criatura ${position + 1}: ${problem}` };
    if (creatures.some((creature) => creature.key === fields.key)) return { ok: false, message: `Criatura "${fields.key}" repetida.` };
    creatures.push({ ...fields, id: fields.key, position });
  }
  return {
    ok: true,
    value: {
      format: TEMPLATE_FORMAT,
      version: 1,
      key,
      name,
      description: localized(value.description, 600),
      system: normalizeSystem(value.system),
      variables,
      items,
      creatures,
    },
  };
}

// O que aplicar um modelo faz na obra: sistema trocado, variáveis que faltam acrescentadas, itens e
// criaturas casados pela chave (o que já existe é atualizado e mantém o id; o resto é criado).
export type ApplyPlan = {
  system: GameSystem;
  variables: VariableDefinition[];
  items: { id: string; isNew: boolean; fields: Omit<Item, "id"> }[];
  creatures: { id: string; isNew: boolean; fields: Omit<Creature, "id"> }[];
};

export function planApply(
  pkg: SystemTemplatePackage,
  current: { system?: GameSystem; variables: VariableDefinition[]; items: Pick<Item, "id" | "key">[]; creatures: Pick<Creature, "id" | "key">[] },
  newId: () => string,
): ApplyPlan {
  const existingItems = new Map(current.items.map((item) => [item.key, item.id]));
  const existingCreatures = new Map(current.creatures.map((creature) => [creature.key, creature.id]));
  const maps: RefMaps = { items: new Map(), creatures: new Map() };
  const itemIds = pkg.items.map((item) => {
    const id = existingItems.get(item.key) ?? newId();
    maps.items.set(item.id, id);
    return { id, isNew: !existingItems.has(item.key) };
  });
  const creatureIds = pkg.creatures.map((creature) => {
    const id = existingCreatures.get(creature.key) ?? newId();
    maps.creatures.set(creature.id, id);
    return { id, isNew: !existingCreatures.has(creature.key) };
  });
  const keys = new Set(current.variables.map((variable) => variable.key));
  const system = remapRefs(pkg.system, maps);
  // Cena escolhida antes para o gatilho de um recurso de mesma chave continua valendo.
  for (const resource of system.resources) {
    const previous = current.system?.resources.find((candidate) => candidate.key === resource.key);
    if (resource.onZero && previous?.onZero?.sceneId) resource.onZero.sceneId = previous.onZero.sceneId;
    if (resource.onFull && previous?.onFull?.sceneId) resource.onFull.sceneId = previous.onFull.sceneId;
  }
  return {
    system,
    variables: [...current.variables, ...pkg.variables.filter((variable) => !keys.has(variable.key))],
    items: pkg.items.map((item, index) => {
      const { id: _packageId, ...fields } = remapRefs(item, maps);
      void _packageId;
      return { ...itemIds[index], fields: { ...fields, position: current.items.length + index } };
    }),
    creatures: pkg.creatures.map((creature, index) => {
      const { id: _packageId, ...fields } = remapRefs(creature, maps);
      void _packageId;
      return { ...creatureIds[index], fields: { ...fields, position: current.creatures.length + index } };
    }),
  };
}

// Resumo do que um modelo liga (cartões do assistente e da lista de modelos).
export function describePackage(pkg: Pick<SystemTemplatePackage, "system" | "items" | "creatures">): string[] {
  const labels: Record<string, string> = {
    resources: "recursos",
    attributes: "atributos",
    dice: "dados",
    inventory: "inventário",
    equipment: "equipamento",
    progression: "nível e XP",
    combat: "combate",
    effects: "efeitos com duração",
    shops: "lojas",
    quests: "missões",
    achievements: "conquistas",
    character: "criação de personagem",
    bestiary: "bestiário",
  };
  const on = Object.entries(pkg.system.modules)
    .filter(([, enabled]) => enabled)
    .map(([module]) => labels[module] ?? module);
  const extras: string[] = [];
  if (pkg.items.length > 0) extras.push(`${pkg.items.length} ${pkg.items.length === 1 ? "item" : "itens"}`);
  if (pkg.creatures.length > 0) extras.push(`${pkg.creatures.length} ${pkg.creatures.length === 1 ? "criatura" : "criaturas"}`);
  return [...on, ...extras];
}
