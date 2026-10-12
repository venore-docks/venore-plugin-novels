import {
  type ChoiceMechanics,
  type Condition,
  type Creature,
  type Effect,
  type GameSystem,
  type Item,
  type SceneMechanics,
} from "../../contracts/game";
import type { VariableDefinition } from "../../contracts/types";
import { BUILTIN_FUNCTIONS, checkFormula, formulaReferences } from "./formula";
import { CONTEXT_FUNCTIONS, knownFormulaNames } from "./rules";

// Validação das regras de jogo (0.10.0): fórmulas, chaves, referências a cenas/itens/criaturas.
// Mesmo formato de problema do validador da história (story-validation.ts).

export type GameIssue = { severity: "error" | "warning"; code: string; message: string; sceneId?: string; choiceId?: string };

const KEY_PATTERN = /^[a-z][a-z0-9_]{0,39}$/;

export type GameValidationInput = {
  system: GameSystem;
  variables: VariableDefinition[];
  items: Pick<Item, "id" | "key" | "useEffects">[];
  creatures: Pick<Creature, "id" | "key" | "loot">[];
  sceneIds: Set<string>;
};

export function formulaChecker(input: Pick<GameValidationInput, "system" | "variables">) {
  const ctx = {
    system: input.system,
    variables: new Map(input.variables.map((variable) => [variable.key, variable])),
    on: (module: keyof GameSystem["modules"]) => input.system.modules[module],
  };
  const names = knownFormulaNames(ctx);
  return (formula: string, extraNames: string[] = [], allowEmpty = false): string | null => {
    if (!formula.trim()) return allowEmpty ? null : "fórmula vazia";
    const parsed = checkFormula(formula);
    if (!parsed.ok) return parsed.message;
    const refs = formulaReferences(parsed.node);
    for (const name of refs.names) {
      if (names.has(name) || extraNames.includes(name)) continue;
      if (extraNames.some((prefix) => prefix.endsWith(".") && name.startsWith(prefix))) continue;
      return `"${name}" não existe`;
    }
    for (const fn of refs.functions) if (!BUILTIN_FUNCTIONS.includes(fn) && !CONTEXT_FUNCTIONS.has(fn)) return `função "${fn}" não existe`;
    return null;
  };
}

export function validateGameSystem(input: GameValidationInput): GameIssue[] {
  const { system } = input;
  const issues: GameIssue[] = [];
  const error = (code: string, message: string) => issues.push({ severity: "error", code, message });
  const check = formulaChecker(input);
  const formula = (where: string, value: string, extra: string[] = [], allowEmpty = false) => {
    const problem = check(value, extra, allowEmpty);
    if (problem) error("invalid_formula", `${where}: ${problem}.`);
  };

  // Chaves: únicas entre variáveis, recursos, atributos, derivados e chaves da progressão.
  const seen = new Map<string, string>();
  const claim = (key: string, owner: string) => {
    if (!KEY_PATTERN.test(key)) error("invalid_game_key", `${owner} "${key}": use letras minúsculas, números e _ (começando por letra).`);
    else if (seen.has(key)) error("duplicate_game_key", `A chave "${key}" é usada por ${seen.get(key)} e por ${owner}.`);
    else seen.set(key, owner);
  };
  for (const variable of input.variables) seen.set(variable.key, `variável "${variable.key}"`);
  if (system.modules.resources) for (const resource of system.resources) claim(resource.key, "recurso");
  if (system.modules.attributes) {
    for (const attribute of system.attributes) claim(attribute.key, attribute.kind === "skill" ? "habilidade" : "atributo");
    for (const derived of system.derived) claim(derived.key, "valor derivado");
  }
  if (system.modules.progression) {
    claim(system.progression.xpKey, "experiência");
    claim(system.progression.levelKey, "nível");
    claim(system.progression.pointsKey, "pontos");
  }
  if (system.modules.shops && system.currency.mode === "counter") claim(system.currency.key, "moeda");

  const sceneRef = (where: string, sceneId: string | null | undefined) => {
    if (sceneId && !input.sceneIds.has(sceneId)) error("missing_scene", `${where}: a cena escolhida não existe mais.`);
  };
  const itemIds = new Set(input.items.map((item) => item.id));
  const creatureIds = new Set(input.creatures.map((creature) => creature.id));

  if (system.modules.resources) {
    for (const resource of system.resources) {
      const name = `Recurso "${resource.key}"`;
      formula(`${name}, máximo`, resource.max);
      if (resource.initial.trim() && resource.initial.trim() !== "max") formula(`${name}, inicial`, resource.initial);
      formula(`${name}, regeneração`, resource.regen, [], true);
      sceneRef(`${name}, ao zerar`, resource.onZero?.sceneId);
      sceneRef(`${name}, ao lotar`, resource.onFull?.sceneId);
      for (const effect of [...(resource.onZero?.effects ?? []), ...(resource.onFull?.effects ?? [])]) {
        issues.push(...validateEffect(effect, input, name));
      }
    }
  }
  if (system.modules.attributes) {
    for (const attribute of system.attributes) {
      formula(`"${attribute.key}", teto`, attribute.cap, [], true);
      if (attribute.training.enabled) formula(`"${attribute.key}", treino`, attribute.training.threshold, ["valor", "value"]);
    }
    for (const derived of system.derived) formula(`Valor derivado "${derived.key}"`, derived.formula);
  }
  if (system.modules.progression) {
    const curve = system.progression.curve;
    if (curve.kind === "formula") formula("Curva de XP", curve.formula, ["n"]);
    else if (curve.thresholds.some((value, index) => index > 0 && value <= curve.thresholds[index - 1])) {
      error("invalid_xp_table", "Tabela de XP: cada nível precisa de mais XP que o anterior.");
    }
    formula("Teto dos atributos por nível", system.progression.attributeCap, [], true);
    for (const effect of system.progression.onLevelUp) issues.push(...validateEffect(effect, input, "Ao subir de nível"));
  }
  if (system.modules.inventory && system.inventory.weight.enabled) formula("Peso máximo", system.inventory.weight.max);
  if (system.modules.combat) {
    const combatNames = ["dado", "die", "atacante.", "defensor.", "alvo."];
    if (!system.resources.some((resource) => resource.key === system.combat.hpResource)) {
      error("missing_hp_resource", "Combate: escolha qual recurso é a vida.");
    }
    formula("Combate, dado", system.combat.die);
    formula("Combate, dano dos inimigos", system.combat.enemy.damage, combatNames);
    formula("Combate, redução contra inimigos", system.combat.enemy.reduction, combatNames);
    formula("Combate, acerto dos inimigos", system.combat.enemy.hit, combatNames, true);
    formula("Combate, fuga (rolagem)", system.combat.flee.roll);
    formula("Combate, fuga (dificuldade)", system.combat.flee.dc);
    const actionKeys = new Set<string>();
    for (const action of system.combat.actions) {
      if (!KEY_PATTERN.test(action.key) || actionKeys.has(action.key)) error("invalid_action_key", `Ação de combate "${action.key}": chave inválida ou repetida.`);
      actionKeys.add(action.key);
      formula(`Ação "${action.key}", dano`, action.damage, combatNames);
      formula(`Ação "${action.key}", redução`, action.reduction, combatNames);
      formula(`Ação "${action.key}", acerto`, action.hit, combatNames, true);
      for (const cost of action.cost) issues.push(...validateCost(cost, input, `Ação "${action.key}"`));
      for (const condition of action.requires) issues.push(...validateCondition(condition, input, `Ação "${action.key}"`));
    }
  }
  if (system.modules.dice && system.dice.reroll.enabled) {
    for (const cost of system.dice.reroll.cost) issues.push(...validateCost(cost, input, "Rolar de novo"));
  }
  if (system.modules.character) {
    for (const vocation of system.character.vocations) {
      for (const entry of vocation.items) if (!itemIds.has(entry.itemId)) error("missing_item", `Vocação: item que não existe mais.`);
    }
  }
  if (system.modules.shops && system.currency.mode === "item" && (!system.currency.itemId || !itemIds.has(system.currency.itemId))) {
    error("missing_item", "Moeda: escolha o item que é o dinheiro.");
  }
  if (system.modules.effects) {
    for (const effect of system.statusEffects) {
      for (const tick of effect.perScene) issues.push(...validateEffect(tick, input, `Efeito "${effect.id}"`));
    }
  }
  for (const item of input.items) for (const effect of item.useEffects) issues.push(...validateEffect(effect, input, `Item "${item.key}"`));
  for (const creature of input.creatures) {
    for (const entry of creature.loot) if (!itemIds.has(entry.itemId)) error("missing_item", `Criatura "${creature.key}": saque com item que não existe mais.`);
  }
  void creatureIds;
  return issues;
}

function validateCost(cost: { resource: string; amount: string }, input: GameValidationInput, where: string): GameIssue[] {
  const issues: GameIssue[] = [];
  if (!input.system.modules.resources || !input.system.resources.some((resource) => resource.key === cost.resource)) {
    issues.push({ severity: "error", code: "unknown_resource", message: `${where}: custo em recurso que não existe.` });
  }
  const problem = formulaChecker(input)(cost.amount);
  if (problem) issues.push({ severity: "error", code: "invalid_formula", message: `${where}, custo: ${problem}.` });
  return issues;
}

export function validateEffect(effect: Effect, input: GameValidationInput, where: string): GameIssue[] {
  if (!("kind" in effect) || effect.kind === undefined) return [];
  const issues: GameIssue[] = [];
  const error = (code: string, message: string) => issues.push({ severity: "error", code, message: `${where}: ${message}` });
  const check = formulaChecker(input);
  const itemIds = new Set(input.items.map((item) => item.id));
  const { system } = input;
  switch (effect.kind) {
    case "formula": {
      const targets = new Set([
        ...input.variables.filter((variable) => variable.type === "number").map((variable) => variable.key),
        ...(system.modules.resources ? system.resources.map((resource) => resource.key) : []),
        ...(system.modules.attributes ? system.attributes.map((attribute) => attribute.key) : []),
        ...(system.modules.progression ? [system.progression.xpKey, system.progression.pointsKey] : []),
        ...(system.modules.shops && system.currency.mode === "counter" ? [system.currency.key] : []),
      ]);
      if (!targets.has(effect.target)) error("unknown_target", `efeito altera "${effect.target}", que não existe.`);
      const problem = check(effect.formula);
      if (problem) error("invalid_formula", `${problem}.`);
      break;
    }
    case "restore":
      if (!system.resources.some((resource) => resource.key === effect.target)) error("unknown_target", "recurso que não existe.");
      break;
    case "item":
    case "equip":
    case "unequip":
      if (!itemIds.has(effect.itemId)) error("missing_item", "item que não existe mais.");
      if (effect.kind === "item") {
        const problem = check(effect.quantity);
        if (problem) error("invalid_formula", `quantidade: ${problem}.`);
      }
      break;
    case "loot":
      for (const entry of effect.entries) if (!itemIds.has(entry.itemId)) error("missing_item", "saque com item que não existe mais.");
      break;
    case "xp": {
      if (!system.modules.progression) error("module_off", "dá XP, mas a progressão está desligada.");
      const problem = check(effect.amount);
      if (problem) error("invalid_formula", `XP: ${problem}.`);
      break;
    }
    case "status":
      if (!system.modules.effects || !system.statusEffects.some((status) => status.id === effect.effectId)) error("unknown_status", "efeito com duração que não existe.");
      break;
    case "quest":
      if (!system.modules.quests || !system.quests.some((quest) => quest.id === effect.questId)) error("unknown_quest", "missão que não existe.");
      break;
    case "achievement":
      if (!system.modules.achievements || !system.achievements.some((achievement) => achievement.id === effect.achievementId)) {
        error("unknown_achievement", "conquista que não existe.");
      }
      break;
  }
  return issues;
}

export function validateCondition(condition: Condition, input: GameValidationInput, where: string): GameIssue[] {
  if (!("kind" in condition) || condition.kind === undefined) return [];
  const issues: GameIssue[] = [];
  const error = (code: string, message: string) => issues.push({ severity: "error", code, message: `${where}: ${message}` });
  const itemIds = new Set(input.items.map((item) => item.id));
  switch (condition.kind) {
    case "formula": {
      const problem = formulaChecker(input)(condition.formula);
      if (problem) error("invalid_formula", `condição: ${problem}.`);
      break;
    }
    case "item":
    case "equipped":
    case "fits":
      if (!itemIds.has(condition.itemId)) error("missing_item", "condição com item que não existe mais.");
      break;
    case "quest":
      if (!input.system.quests.some((quest) => quest.id === condition.questId)) error("unknown_quest", "condição com missão que não existe.");
      break;
    case "profile":
      if (!input.system.character.fields.some((field) => field.key === condition.field)) error("unknown_profile_field", "condição com campo da ficha que não existe.");
      break;
    case "achievement":
      if (!input.system.achievements.some((achievement) => achievement.id === condition.achievementId)) error("unknown_achievement", "condição com conquista que não existe.");
      break;
    case "status":
      if (!input.system.statusEffects.some((status) => status.id === condition.effectId)) error("unknown_status", "condição com efeito que não existe.");
      break;
  }
  return issues;
}

// Destinos extras de uma cena/escolha além da seta normal (teste, encontro): entram na
// alcançabilidade e precisam estar no mesmo capítulo.
export function extraTargets(mechanics: ChoiceMechanics | undefined): string[] {
  const test = mechanics?.test;
  if (!test) return [];
  return [test.failure.targetSceneId, test.critical?.targetSceneId, test.fumble?.targetSceneId, ...test.bands.map((band) => band.targetSceneId)].filter(
    (id): id is string => Boolean(id),
  );
}

export function encounterTargets(mechanics: SceneMechanics | undefined): string[] {
  const encounter = mechanics?.kind === "encounter" ? mechanics.encounter : null;
  if (!encounter) return [];
  return [encounter.victorySceneId, encounter.defeatSceneId, encounter.fleeSceneId].filter((id): id is string => Boolean(id));
}

export function validateSceneMechanics(mechanics: SceneMechanics, input: GameValidationInput, where: string): GameIssue[] {
  const issues: GameIssue[] = [];
  const error = (code: string, message: string) => issues.push({ severity: "error", code, message: `${where}: ${message}` });
  const { system } = input;
  if (mechanics.kind === "encounter") {
    if (!system.modules.combat) error("module_off", "é um encontro, mas o combate está desligado.");
    const encounter = mechanics.encounter;
    if (!encounter || encounter.creatures.length === 0) error("empty_encounter", "encontro sem criaturas.");
    for (const entry of encounter?.creatures ?? []) {
      if (!input.creatures.some((creature) => creature.id === entry.creatureId)) error("missing_creature", "criatura que não existe mais.");
    }
    if (encounter?.mode === "single") {
      const check = formulaChecker(input);
      for (const [label, value] of [
        ["rolagem", encounter.single.roll],
        ["dificuldade", encounter.single.dc],
        ["perda de vida", encounter.single.hpLoss],
      ] as const) {
        const problem = check(value);
        if (problem) error("invalid_formula", `${label}: ${problem}.`);
      }
    }
    for (const target of encounterTargets(mechanics)) if (!input.sceneIds.has(target)) error("missing_target", "saída do encontro para cena que não existe.");
  }
  if (mechanics.kind === "shop") {
    if (!system.modules.shops) error("module_off", "é uma loja, mas as lojas estão desligadas.");
    for (const entry of mechanics.shop?.items ?? []) {
      if (!input.items.some((item) => item.id === entry.itemId)) error("missing_item", "loja com item que não existe mais.");
    }
  }
  for (const target of Object.values(mechanics.onZero)) if (target && !input.sceneIds.has(target)) error("missing_target", "ao zerar: cena que não existe.");
  return issues;
}

export function validateChoiceMechanics(mechanics: ChoiceMechanics, input: GameValidationInput, where: string): GameIssue[] {
  const issues: GameIssue[] = [];
  for (const cost of mechanics.cost) issues.push(...validateCost(cost, input, where));
  const test = mechanics.test;
  if (test) {
    if (!input.system.modules.dice) issues.push({ severity: "error", code: "module_off", message: `${where}: tem teste de dados, mas os dados estão desligados.` });
    const check = formulaChecker(input);
    const roll = check(test.roll);
    if (roll) issues.push({ severity: "error", code: "invalid_formula", message: `${where}, rolagem: ${roll}.` });
    if (test.bands.length === 0) {
      const dc = check(test.dc);
      if (dc) issues.push({ severity: "error", code: "invalid_formula", message: `${where}, dificuldade: ${dc}.` });
    }
    for (const effect of [...test.successEffects, ...test.failure.effects, ...(test.critical?.effects ?? []), ...(test.fumble?.effects ?? [])]) {
      issues.push(...validateEffect(effect, input, where));
    }
    for (const target of extraTargets(mechanics)) {
      if (!input.sceneIds.has(target)) issues.push({ severity: "error", code: "missing_target", message: `${where}: resultado do teste leva a uma cena que não existe.` });
    }
  }
  return issues;
}
