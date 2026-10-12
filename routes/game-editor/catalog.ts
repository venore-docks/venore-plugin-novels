import type { Creature, GameSystem, Item } from "../../contracts/game";
import type { LocalizedText, VariableDefinition } from "../../contracts/types";
import { pickText } from "../../shared/localized-text";

// O que os editores de regra (efeito, condição, fórmula, teste) precisam saber da obra: variáveis,
// sistema, catálogo e cenas que podem ser destino. Montado uma vez por página (useMemo).
export type GameCatalog = {
  locale: string;
  locales: string[];
  variables: VariableDefinition[];
  system: GameSystem;
  items: Item[];
  creatures: Creature[];
  // Cenas que podem ser destino aqui (no grafo: as do capítulo).
  scenes: { id: string; label: string }[];
  // Todas as cenas da obra (gatilhos de recurso podem ir para outro capítulo).
  allScenes: { id: string; label: string }[];
};

export const SELECT_CLASS = "h-9 min-w-0 max-w-full rounded-md border border-border bg-background px-2 text-sm text-foreground";

export function name(catalog: Pick<GameCatalog, "locale">, text: LocalizedText | undefined, fallback = ""): string {
  return pickText(text ?? {}, catalog.locale, catalog.locale) || fallback;
}

export type NumberTarget = { key: string; label: string; group: string };

// Números que um efeito pode alterar: variáveis numéricas, recursos, atributos, XP, pontos, moeda.
export function numberTargets(catalog: GameCatalog): NumberTarget[] {
  const { system } = catalog;
  const targets: NumberTarget[] = [];
  if (system.modules.resources) for (const resource of system.resources) targets.push({ key: resource.key, label: name(catalog, resource.name, resource.key), group: "Recursos" });
  if (system.modules.attributes) {
    for (const attribute of system.attributes) {
      targets.push({ key: attribute.key, label: name(catalog, attribute.name, attribute.key), group: attribute.kind === "skill" ? "Habilidades" : "Atributos" });
    }
  }
  if (system.modules.progression) {
    targets.push({ key: system.progression.xpKey, label: name(catalog, system.progression.xpName, "XP"), group: "Progressão" });
    targets.push({ key: system.progression.pointsKey, label: name(catalog, system.progression.pointsName, "Pontos"), group: "Progressão" });
  }
  if (system.modules.shops && system.currency.mode === "counter") targets.push({ key: system.currency.key, label: name(catalog, system.currency.name, "Moeda"), group: "Loja" });
  for (const variable of catalog.variables) {
    if (variable.type === "number") targets.push({ key: variable.key, label: variable.label || variable.key, group: "Variáveis" });
  }
  return targets.filter((target) => target.key);
}

// Nomes para a linguagem de fórmulas com o rótulo de cada um (autocompletar).
export function formulaNames(catalog: GameCatalog): { name: string; hint: string }[] {
  const { system } = catalog;
  const names: { name: string; hint: string }[] = [];
  for (const variable of catalog.variables) names.push({ name: variable.key, hint: variable.label || "variável" });
  if (system.modules.resources) {
    for (const resource of system.resources) {
      names.push({ name: resource.key, hint: name(catalog, resource.name, "recurso") });
      names.push({ name: `${resource.key}.max`, hint: `máximo de ${name(catalog, resource.name, resource.key)}` });
    }
  }
  if (system.modules.attributes) {
    for (const attribute of system.attributes) {
      names.push({ name: attribute.key, hint: name(catalog, attribute.name, "atributo") });
      names.push({ name: `${attribute.key}.base`, hint: `${name(catalog, attribute.name, attribute.key)} sem bônus` });
    }
    for (const derived of system.derived) names.push({ name: derived.key, hint: name(catalog, derived.name, "derivado") });
  }
  if (system.modules.progression) {
    names.push({ name: system.progression.levelKey, hint: name(catalog, system.progression.levelName, "nível") });
    names.push({ name: system.progression.xpKey, hint: name(catalog, system.progression.xpName, "XP") });
    names.push({ name: system.progression.pointsKey, hint: name(catalog, system.progression.pointsName, "pontos") });
  }
  if (system.modules.shops && system.currency.mode === "counter") names.push({ name: system.currency.key, hint: name(catalog, system.currency.name, "moeda") });
  return names.filter((entry) => entry.name);
}

export const FUNCTION_HINTS: { name: string; hint: string }[] = [
  { name: "min", hint: "min(a, b, …)" },
  { name: "max", hint: "max(a, b, …)" },
  { name: "arred", hint: "arred(x, casas)" },
  { name: "piso", hint: "arredonda para baixo" },
  { name: "teto", hint: "arredonda para cima" },
  { name: "abs", hint: "valor absoluto" },
  { name: "limitar", hint: "limitar(x, mín, máx)" },
  { name: "se", hint: "se(condição, sim, não)" },
  { name: "tem", hint: 'tem("chave_do_item")' },
  { name: "equipado", hint: 'equipado("chave_do_item")' },
  { name: "cabe", hint: 'cabe("chave_do_item")' },
  { name: "perfil", hint: 'perfil("sexo")' },
  { name: "missao", hint: 'missao("id") = "ativa"' },
  { name: "etapa", hint: 'etapa("id_da_missão")' },
  { name: "conquista", hint: 'conquista("id")' },
  { name: "efeito", hint: 'efeito("id")' },
];

// Nomes do combate: dado e os dois lados (atacante./defensor.) com as chaves de atributo.
export const COMBAT_EXTRA = ["dado", "die", "atacante.", "defensor.", "alvo."];

export function combatNames(catalog: GameCatalog): { name: string; hint: string }[] {
  const keys = new Set<string>(["hp", "hp.max"]);
  for (const attribute of catalog.system.attributes) keys.add(attribute.key);
  for (const derived of catalog.system.derived) keys.add(derived.key);
  for (const resource of catalog.system.resources) keys.add(resource.key).add(`${resource.key}.max`);
  keys.add(catalog.system.progression.levelKey);
  for (const creature of catalog.creatures) for (const key of Object.keys(creature.stats)) keys.add(key);
  const names: { name: string; hint: string }[] = [{ name: "dado", hint: "valor do dado de combate" }];
  for (const key of keys) {
    names.push({ name: `atacante.${key}`, hint: "quem ataca" });
    names.push({ name: `defensor.${key}`, hint: "quem defende" });
  }
  return names;
}

export function itemLabel(catalog: GameCatalog, itemId: string): string {
  const item = catalog.items.find((candidate) => candidate.id === itemId);
  return item ? name(catalog, item.name, item.key) : "item apagado";
}
