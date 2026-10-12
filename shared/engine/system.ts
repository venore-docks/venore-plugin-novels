import {
  GAME_MODULES,
  type ChoiceMechanics,
  type GameModule,
  type GameSystem,
  type SceneMechanics,
} from "../../contracts/game";
import { ACCENT_COLORS, type AccentColor, type LocalizedText } from "../../contracts/types";
import { sanitizeConditions, sanitizeEffects } from "./sanitize";

// Sistema de jogo vazio (obra só narrativa) e normalização do que vem do banco/formulário: campo
// faltando volta ao padrão, valor fora da lista volta ao padrão. Obra antiga (sem sistema) lê como
// "só variáveis".

const t = (pt: string, en?: string): LocalizedText => (en ? { "pt-BR": pt, en } : { "pt-BR": pt });

export function emptySystem(): GameSystem {
  return {
    version: 1,
    modules: Object.fromEntries(GAME_MODULES.map((module) => [module, false])) as Record<GameModule, boolean>,
    resources: [],
    attributes: [],
    derived: [],
    progression: {
      xpKey: "xp",
      xpName: t("Experiência", "Experience"),
      levelKey: "nivel",
      levelName: t("Nível", "Level"),
      curve: { kind: "formula", formula: "50 * (n - 1) * n" },
      maxLevel: 100,
      pointsKey: "pontos",
      pointsName: t("Pontos", "Points"),
      pointsPerLevel: 1,
      pointCosts: [
        { upTo: 10, cost: 1 },
        { upTo: 15, cost: 2 },
        { upTo: null, cost: 3 },
      ],
      attributeCap: "",
      onLevelUp: [],
    },
    inventory: {
      weight: { enabled: false, name: t("Peso", "Weight"), unit: t("oz"), max: "400", countEquipped: true, overLimit: "block", penalty: [] },
      space: { enabled: false, name: t("Mochila", "Backpack"), base: 8 },
      hands: { enabled: false, name: t("Mãos", "Hands"), count: 2 },
    },
    slots: [],
    dice: {
      showDc: "words",
      words: [
        { upTo: 8, label: t("fácil", "easy") },
        { upTo: 14, label: t("médio", "medium") },
        { upTo: 1000, label: t("difícil", "hard") },
      ],
      reroll: { enabled: false, cost: [] },
    },
    combat: {
      hpResource: "",
      die: "1d10 / 10",
      actions: [],
      enemy: { damage: "max(1, atacante.ataque - defensor.defesa)", reduction: "0", hit: "" },
      defend: { enabled: true, reductionBonus: 0.5 },
      flee: { enabled: true, roll: "1d20", dc: "10" },
      minDamage: 1,
      maxReduction: 0.9,
    },
    character: { fields: [], vocations: [], startingPoints: 0 },
    currency: { mode: "counter", key: "moedas", name: t("Moedas", "Coins"), itemId: null },
    statusEffects: [],
    quests: [],
    achievements: [],
    hardcore: false,
    series: { previousWorkId: null, carry: [] },
  };
}

const isObject = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const list = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);
const text = (value: unknown, fallback: LocalizedText = {}): LocalizedText =>
  isObject(value)
    ? Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string"))
    : fallback;
const str = (value: unknown, fallback = ""): string => (typeof value === "string" ? value : typeof value === "number" ? String(value) : fallback);
const num = (value: unknown, fallback = 0): number => (typeof value === "number" && Number.isFinite(value) ? value : fallback);
const bool = (value: unknown, fallback = false): boolean => (typeof value === "boolean" ? value : fallback);
const oneOf = <T extends string>(value: unknown, options: readonly T[], fallback: T): T =>
  options.includes(value as T) ? (value as T) : fallback;
const color = (value: unknown): AccentColor => oneOf(value, ACCENT_COLORS, "primary");

export function normalizeSystem(raw: unknown): GameSystem {
  const base = emptySystem();
  if (!isObject(raw)) return base;
  const modules = isObject(raw.modules) ? raw.modules : {};
  const progression = isObject(raw.progression) ? raw.progression : {};
  const curve = isObject(progression.curve) ? progression.curve : {};
  const inventory = isObject(raw.inventory) ? raw.inventory : {};
  const weight = isObject(inventory.weight) ? inventory.weight : {};
  const space = isObject(inventory.space) ? inventory.space : {};
  const hands = isObject(inventory.hands) ? inventory.hands : {};
  const dice = isObject(raw.dice) ? raw.dice : {};
  const reroll = isObject(dice.reroll) ? dice.reroll : {};
  const combat = isObject(raw.combat) ? raw.combat : {};
  const enemy = isObject(combat.enemy) ? combat.enemy : {};
  const defend = isObject(combat.defend) ? combat.defend : {};
  const flee = isObject(combat.flee) ? combat.flee : {};
  const character = isObject(raw.character) ? raw.character : {};
  const currency = isObject(raw.currency) ? raw.currency : {};
  const series = isObject(raw.series) ? raw.series : {};
  const trigger = (value: unknown) =>
    isObject(value) ? { sceneId: typeof value.sceneId === "string" && value.sceneId ? value.sceneId : null, effects: sanitizeEffects(value.effects) } : null;
  const costs = (value: unknown) =>
    list<Record<string, unknown>>(value)
      .filter(isObject)
      .map((cost) => ({ resource: str(cost.resource), amount: str(cost.amount, "0") }));
  const modifiers = (value: unknown) =>
    list<Record<string, unknown>>(value)
      .filter(isObject)
      .map((modifier) => ({ target: str(modifier.target), amount: num(modifier.amount) }));

  return {
    version: 1,
    modules: Object.fromEntries(GAME_MODULES.map((module) => [module, bool(modules[module])])) as Record<GameModule, boolean>,
    resources: list<Record<string, unknown>>(raw.resources)
      .filter(isObject)
      .map((resource) => ({
        key: str(resource.key),
        name: text(resource.name),
        abbr: text(resource.abbr),
        color: color(resource.color),
        max: str(resource.max, "100"),
        initial: str(resource.initial, "max"),
        regen: str(resource.regen),
        regenInCombat: bool(resource.regenInCombat),
        onZero: trigger(resource.onZero),
        onFull: trigger(resource.onFull),
        showInHud: bool(resource.showInHud, true),
        lowPercent: num(resource.lowPercent, 25),
      })),
    attributes: list<Record<string, unknown>>(raw.attributes)
      .filter(isObject)
      .map((attribute) => {
        const training = isObject(attribute.training) ? attribute.training : {};
        return {
          key: str(attribute.key),
          name: text(attribute.name),
          abbr: text(attribute.abbr),
          kind: oneOf(attribute.kind, ["stat", "skill"] as const, "stat"),
          initial: num(attribute.initial),
          min: num(attribute.min),
          cap: str(attribute.cap),
          showInHud: bool(attribute.showInHud),
          training: { enabled: bool(training.enabled), threshold: str(training.threshold, "10 * (valor + 1)") },
        };
      }),
    derived: list<Record<string, unknown>>(raw.derived)
      .filter(isObject)
      .map((derived) => ({ key: str(derived.key), name: text(derived.name), formula: str(derived.formula, "0"), show: bool(derived.show, true) })),
    progression: {
      xpKey: str(progression.xpKey, base.progression.xpKey) || base.progression.xpKey,
      xpName: text(progression.xpName, base.progression.xpName),
      levelKey: str(progression.levelKey, base.progression.levelKey) || base.progression.levelKey,
      levelName: text(progression.levelName, base.progression.levelName),
      curve:
        curve.kind === "table"
          ? { kind: "table", thresholds: list<unknown>(curve.thresholds).map((value) => num(value)).filter((value) => value >= 0) }
          : { kind: "formula", formula: str(curve.formula, (base.progression.curve as { formula: string }).formula) },
      maxLevel: Math.max(1, Math.min(1000, Math.trunc(num(progression.maxLevel, 100)))),
      pointsKey: str(progression.pointsKey, base.progression.pointsKey) || base.progression.pointsKey,
      pointsName: text(progression.pointsName, base.progression.pointsName),
      pointsPerLevel: Math.max(0, Math.trunc(num(progression.pointsPerLevel, 1))),
      pointCosts: list<Record<string, unknown>>(progression.pointCosts).filter(isObject).length
        ? list<Record<string, unknown>>(progression.pointCosts)
            .filter(isObject)
            .map((tier) => ({ upTo: typeof tier.upTo === "number" ? tier.upTo : null, cost: Math.max(0, num(tier.cost, 1)) }))
        : base.progression.pointCosts,
      attributeCap: str(progression.attributeCap),
      onLevelUp: sanitizeEffects(progression.onLevelUp),
    },
    inventory: {
      weight: {
        enabled: bool(weight.enabled),
        name: text(weight.name, base.inventory.weight.name),
        unit: text(weight.unit, base.inventory.weight.unit),
        max: str(weight.max, "400"),
        countEquipped: bool(weight.countEquipped, true),
        overLimit: oneOf(weight.overLimit, ["block", "penalty"] as const, "block"),
        penalty: modifiers(weight.penalty),
      },
      space: { enabled: bool(space.enabled), name: text(space.name, base.inventory.space.name), base: Math.max(0, Math.trunc(num(space.base, 8))) },
      hands: { enabled: bool(hands.enabled), name: text(hands.name, base.inventory.hands.name), count: Math.max(0, Math.trunc(num(hands.count, 2))) },
    },
    slots: list<Record<string, unknown>>(raw.slots)
      .filter(isObject)
      .map((slot) => ({ key: str(slot.key), name: text(slot.name), count: Math.max(1, Math.trunc(num(slot.count, 1))) })),
    dice: {
      showDc: oneOf(dice.showDc, ["number", "words", "hidden"] as const, "words"),
      words: list<Record<string, unknown>>(dice.words).filter(isObject).length
        ? list<Record<string, unknown>>(dice.words)
            .filter(isObject)
            .map((word) => ({ upTo: num(word.upTo), label: text(word.label) }))
        : base.dice.words,
      reroll: { enabled: bool(reroll.enabled), cost: costs(reroll.cost) },
    },
    combat: {
      hpResource: str(combat.hpResource),
      die: str(combat.die, base.combat.die),
      actions: list<Record<string, unknown>>(combat.actions)
        .filter(isObject)
        .map((action) => ({
          key: str(action.key),
          name: text(action.name),
          damage: str(action.damage, "1"),
          reduction: str(action.reduction, "0"),
          hit: str(action.hit),
          cost: costs(action.cost),
          trains: typeof action.trains === "string" && action.trains ? action.trains : null,
          requires: sanitizeConditions(action.requires),
        })),
      enemy: {
        damage: str(enemy.damage, base.combat.enemy.damage),
        reduction: str(enemy.reduction, base.combat.enemy.reduction),
        hit: str(enemy.hit),
      },
      defend: { enabled: bool(defend.enabled, true), reductionBonus: Math.max(0, Math.min(1, num(defend.reductionBonus, 0.5))) },
      flee: { enabled: bool(flee.enabled, true), roll: str(flee.roll, "1d20"), dc: str(flee.dc, "10") },
      minDamage: Math.max(0, num(combat.minDamage, 1)),
      maxReduction: Math.max(0, Math.min(0.99, num(combat.maxReduction, 0.9))),
    },
    character: {
      fields: list<Record<string, unknown>>(character.fields)
        .filter(isObject)
        .map((field) => ({
          key: str(field.key),
          name: text(field.name),
          kind: oneOf(field.kind, ["text", "choice"] as const, "text"),
          options: list<Record<string, unknown>>(field.options)
            .filter(isObject)
            .map((option) => ({ value: str(option.value), name: text(option.name) })),
          fallback: str(field.fallback),
        })),
      vocations: list<Record<string, unknown>>(character.vocations)
        .filter(isObject)
        .map((vocation) => ({
          id: str(vocation.id),
          name: text(vocation.name),
          description: text(vocation.description),
          imageMediaId: typeof vocation.imageMediaId === "string" && vocation.imageMediaId ? vocation.imageMediaId : null,
          values: isObject(vocation.values)
            ? Object.fromEntries(Object.entries(vocation.values).map(([key, value]) => [key, num(value)]))
            : {},
          items: list<Record<string, unknown>>(vocation.items)
            .filter(isObject)
            .map((item) => ({ itemId: str(item.itemId), quantity: Math.max(1, Math.trunc(num(item.quantity, 1))) })),
        })),
      startingPoints: Math.max(0, Math.trunc(num(character.startingPoints))),
    },
    currency: {
      mode: oneOf(currency.mode, ["counter", "item"] as const, "counter"),
      key: str(currency.key, "moedas") || "moedas",
      name: text(currency.name, base.currency.name),
      itemId: typeof currency.itemId === "string" && currency.itemId ? currency.itemId : null,
    },
    statusEffects: list<Record<string, unknown>>(raw.statusEffects)
      .filter(isObject)
      .map((effect) => ({
        id: str(effect.id),
        name: text(effect.name),
        color: color(effect.color),
        duration: typeof effect.duration === "number" && effect.duration > 0 ? Math.trunc(effect.duration) : null,
        perScene: sanitizeEffects(effect.perScene),
        modifiers: modifiers(effect.modifiers),
      })),
    quests: list<Record<string, unknown>>(raw.quests)
      .filter(isObject)
      .map((quest) => ({
        id: str(quest.id),
        name: text(quest.name),
        description: text(quest.description),
        steps: list<Record<string, unknown>>(quest.steps)
          .filter(isObject)
          .map((step) => ({ id: str(step.id), text: text(step.text) })),
      })),
    achievements: list<Record<string, unknown>>(raw.achievements)
      .filter(isObject)
      .map((achievement) => ({ id: str(achievement.id), name: text(achievement.name), description: text(achievement.description), hidden: bool(achievement.hidden) })),
    hardcore: bool(raw.hardcore),
    series: {
      previousWorkId: typeof series.previousWorkId === "string" && series.previousWorkId ? series.previousWorkId : null,
      carry: list<unknown>(series.carry).map((key) => str(key)).filter(Boolean),
    },
  };
}

export function emptySceneMechanics(): SceneMechanics {
  return { kind: "text", onZero: {}, noRegen: false, encounter: null, shop: null };
}

export function normalizeSceneMechanics(raw: unknown): SceneMechanics {
  const base = emptySceneMechanics();
  if (!isObject(raw)) return base;
  const encounter = isObject(raw.encounter) ? raw.encounter : null;
  const single = encounter && isObject(encounter.single) ? encounter.single : {};
  const shop = isObject(raw.shop) ? raw.shop : null;
  const sceneRef = (value: unknown) => (typeof value === "string" && value ? value : null);
  return {
    kind: oneOf(raw.kind, ["text", "encounter", "shop"] as const, "text"),
    onZero: isObject(raw.onZero)
      ? Object.fromEntries(Object.entries(raw.onZero).map(([key, value]) => [key, sceneRef(value)]))
      : {},
    noRegen: bool(raw.noRegen),
    encounter: encounter
      ? {
          creatures: list<Record<string, unknown>>(encounter.creatures)
            .filter(isObject)
            .map((entry) => ({ creatureId: str(entry.creatureId), count: Math.max(1, Math.min(10, Math.trunc(num(entry.count, 1)))) })),
          mode: oneOf(encounter.mode, ["rounds", "single"] as const, "rounds"),
          victorySceneId: sceneRef(encounter.victorySceneId),
          defeatSceneId: sceneRef(encounter.defeatSceneId),
          fleeSceneId: sceneRef(encounter.fleeSceneId),
          single: { roll: str(single.roll, "1d20"), dc: str(single.dc, "10"), hpLoss: str(single.hpLoss, "0") },
        }
      : null,
    shop: shop
      ? {
          items: list<Record<string, unknown>>(shop.items)
            .filter(isObject)
            .map((entry) => ({
              itemId: str(entry.itemId),
              price: Math.max(0, num(entry.price)),
              stock: typeof entry.stock === "number" && entry.stock >= 0 ? Math.trunc(entry.stock) : null,
            })),
          sellRate: Math.max(0, Math.min(1, num(shop.sellRate, 0.5))),
        }
      : null,
  };
}

export function emptyChoiceMechanics(): ChoiceMechanics {
  return { cost: [], whenUnavailable: "hide", test: null };
}

export function normalizeChoiceMechanics(raw: unknown): ChoiceMechanics {
  if (!isObject(raw)) return emptyChoiceMechanics();
  const test = isObject(raw.test) ? raw.test : null;
  const outcome = (value: unknown) =>
    isObject(value) && typeof value.targetSceneId === "string" && value.targetSceneId
      ? { targetSceneId: value.targetSceneId, effects: sanitizeEffects(value.effects) }
      : null;
  return {
    cost: list<Record<string, unknown>>(raw.cost)
      .filter(isObject)
      .map((cost) => ({ resource: str(cost.resource), amount: str(cost.amount, "0") })),
    whenUnavailable: oneOf(raw.whenUnavailable, ["hide", "disable"] as const, "hide"),
    test: test
      ? {
          roll: str(test.roll, "1d20"),
          dc: str(test.dc, "10"),
          label: text(test.label),
          successEffects: sanitizeEffects(test.successEffects),
          failure: outcome(test.failure) ?? { targetSceneId: "", effects: [] },
          critical: outcome(test.critical),
          fumble: outcome(test.fumble),
          bands: list<Record<string, unknown>>(test.bands)
            .filter(isObject)
            .map((band) => ({ min: num(band.min), max: num(band.max), targetSceneId: str(band.targetSceneId), effects: sanitizeEffects(band.effects) })),
        }
      : null,
  };
}

export function isModuleOn(system: GameSystem, module: GameModule): boolean {
  return system.modules[module];
}
