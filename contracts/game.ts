import type { AccentColor, ChoiceCondition, LocalizedText, VariableDefinition, VariableEffect } from "./types";

// Sistema de jogo da obra (0.10.0+): tudo que é RPG é um módulo opcional, com nomes do autor.
// O código só conhece papéis (recurso, atributo, item, área de equipamento), nunca "HP" ou
// "Capacete". Fórmulas usam a linguagem de shared/engine/formula.ts.

export type Formula = string;

export const GAME_MODULES = [
  "resources",
  "attributes",
  "dice",
  "inventory",
  "equipment",
  "progression",
  "combat",
  "effects",
  "shops",
  "quests",
  "achievements",
  "character",
  "bestiary",
] as const;
export type GameModule = (typeof GAME_MODULES)[number];

export type Modifier = { target: string; amount: number };
export type Cost = { resource: string; amount: Formula };

// ------------------------------------------------------------------ efeitos e condições

// Efeito de cena ou escolha. O formato antigo (VariableEffect, sem `kind`) continua valendo.
export type Effect =
  | VariableEffect
  | { kind: "formula"; target: string; operation: "set" | "add"; formula: Formula }
  | { kind: "restore"; target: string }
  | { kind: "item"; operation: "give" | "take"; itemId: string; quantity: Formula }
  | { kind: "equip"; itemId: string }
  | { kind: "unequip"; itemId: string }
  | { kind: "loot"; entries: LootEntry[] }
  | { kind: "xp"; amount: Formula }
  | { kind: "status"; operation: "apply" | "remove"; effectId: string }
  | { kind: "quest"; operation: "start" | "advance" | "complete" | "fail"; questId: string }
  | { kind: "achievement"; achievementId: string };

export type LootEntry = { itemId: string; chance: number; quantity: Formula };

export type Condition =
  | ChoiceCondition
  | { kind: "formula"; formula: Formula }
  | { kind: "item"; itemId: string; min: number }
  | { kind: "equipped"; itemId: string }
  | { kind: "fits"; itemId: string }
  | { kind: "quest"; questId: string; state: "not_started" | "active" | "done" | "failed" }
  | { kind: "profile"; field: string; value: string }
  | { kind: "achievement"; achievementId: string }
  | { kind: "status"; effectId: string };

// ------------------------------------------------------------------ definições do sistema

export type ResourceDef = {
  key: string;
  name: LocalizedText;
  abbr: LocalizedText;
  color: AccentColor;
  max: Formula;
  // "max" = começa cheio.
  initial: Formula;
  // Quanto volta a cada cena (vazio = não regenera); em combate só se regenInCombat.
  regen: Formula;
  regenInCombat: boolean;
  // Ao zerar: efeitos e ida para uma cena (null = fica na cena). Cada cena pode trocar a cena.
  onZero: { sceneId: string | null; effects: Effect[] } | null;
  onFull: { sceneId: string | null; effects: Effect[] } | null;
  showInHud: boolean;
  lowPercent: number;
};

export type AttributeDef = {
  key: string;
  name: LocalizedText;
  abbr: LocalizedText;
  kind: "stat" | "skill";
  initial: number;
  min: number;
  // Teto do valor base (fórmula; vazio = sem teto além do teto por nível da progressão).
  cap: Formula;
  showInHud: boolean;
  // Skill que sobe com o uso: cada uso conta uma tentativa; ao chegar no limiar (fórmula com
  // `valor` = nível atual da skill), sobe 1.
  training: { enabled: boolean; threshold: Formula };
};

export type DerivedDef = { key: string; name: LocalizedText; formula: Formula; show: boolean };

export type ProgressionDef = {
  xpKey: string;
  xpName: LocalizedText;
  levelKey: string;
  levelName: LocalizedText;
  // Fórmula com `n` = nível (XP total para chegar nele) ou tabela (XP do nível 2, 3, ...).
  curve: { kind: "formula"; formula: Formula } | { kind: "table"; thresholds: number[] };
  maxLevel: number;
  pointsKey: string;
  pointsName: LocalizedText;
  pointsPerLevel: number;
  // Custo de um ponto conforme o valor atual do atributo (upTo inclusive; null = daí em diante).
  pointCosts: { upTo: number | null; cost: number }[];
  // Teto relativo ao nível ("nivel + 5"); vazio = sem teto.
  attributeCap: Formula;
  onLevelUp: Effect[];
};

export type InventoryDef = {
  weight: {
    enabled: boolean;
    name: LocalizedText;
    unit: LocalizedText;
    max: Formula;
    countEquipped: boolean;
    overLimit: "block" | "penalty";
    penalty: Modifier[];
  };
  space: { enabled: boolean; name: LocalizedText; base: number };
  hands: { enabled: boolean; name: LocalizedText; count: number };
};

export type EquipmentSlotDef = { key: string; name: LocalizedText; count: number };

export type DiceDef = {
  showDc: "number" | "words" | "hidden";
  words: { upTo: number; label: LocalizedText }[];
  reroll: { enabled: boolean; cost: Cost[] };
};

export type CombatActionDef = {
  key: string;
  name: LocalizedText;
  damage: Formula;
  reduction: Formula;
  hit: Formula;
  cost: Cost[];
  trains: string | null;
  requires: Condition[];
};

export type CombatDef = {
  // Recurso que é a vida (ataques tiram dele).
  hpResource: string;
  // Valor de `dado` em cada ataque (ex: "1d10 / 10").
  die: Formula;
  actions: CombatActionDef[];
  // Como as criaturas atacam (atacante = criatura, defensor = personagem).
  enemy: { damage: Formula; reduction: Formula; hit: Formula };
  defend: { enabled: boolean; reductionBonus: number };
  flee: { enabled: boolean; roll: Formula; dc: Formula };
  minDamage: number;
  maxReduction: number;
};

export type ProfileFieldDef = {
  key: string;
  name: LocalizedText;
  kind: "text" | "choice";
  options: { value: string; name: LocalizedText }[];
  // Valor usado quando não há escolha (leitura em voz alta, leitor sem ficha).
  fallback: string;
};

export type VocationDef = {
  id: string;
  name: LocalizedText;
  description: LocalizedText;
  imageMediaId: string | null;
  values: Record<string, number>;
  items: { itemId: string; quantity: number }[];
};

export type CharacterDef = { fields: ProfileFieldDef[]; vocations: VocationDef[]; startingPoints: number };

export type CurrencyDef = { mode: "counter" | "item"; key: string; name: LocalizedText; itemId: string | null };

export type StatusEffectDef = {
  id: string;
  name: LocalizedText;
  color: AccentColor;
  // Em cenas; null = até ser removido.
  duration: number | null;
  perScene: Effect[];
  modifiers: Modifier[];
};

export type QuestDef = { id: string; name: LocalizedText; description: LocalizedText; steps: { id: string; text: LocalizedText }[] };
export type AchievementDef = { id: string; name: LocalizedText; description: LocalizedText; hidden: boolean };

export type GameSystem = {
  version: 1;
  modules: Record<GameModule, boolean>;
  resources: ResourceDef[];
  attributes: AttributeDef[];
  derived: DerivedDef[];
  progression: ProgressionDef;
  inventory: InventoryDef;
  slots: EquipmentSlotDef[];
  dice: DiceDef;
  combat: CombatDef;
  character: CharacterDef;
  currency: CurrencyDef;
  statusEffects: StatusEffectDef[];
  quests: QuestDef[];
  achievements: AchievementDef[];
  hardcore: boolean;
  series: { previousWorkId: string | null; carry: string[] };
};

// ------------------------------------------------------------------ cena e escolha

export type TestOutcome = { targetSceneId: string; effects: Effect[] };

export type ChoiceTest = {
  roll: Formula;
  dc: Formula;
  // Nome mostrado no botão ("Destreza").
  label: LocalizedText;
  successEffects: Effect[];
  failure: TestOutcome;
  critical: TestOutcome | null;
  fumble: TestOutcome | null;
  // Faixas no lugar de passa/falha: total de min a max leva à cena.
  bands: (TestOutcome & { min: number; max: number })[];
};

export type ChoiceMechanics = {
  cost: Cost[];
  whenUnavailable: "hide" | "disable";
  test: ChoiceTest | null;
};

export type EncounterDef = {
  creatures: { creatureId: string; count: number }[];
  mode: "rounds" | "single";
  victorySceneId: string | null;
  defeatSceneId: string | null;
  fleeSceneId: string | null;
  // Modo "single": um teste resolve a luta; a derrota tira hpLoss.
  single: { roll: Formula; dc: Formula; hpLoss: Formula };
};

export type ShopDef = { items: { itemId: string; price: number; stock: number | null }[]; sellRate: number };

export type SceneMechanics = {
  kind: "text" | "encounter" | "shop";
  // Recurso -> cena ao zerar nesta cena (sobrescreve o padrão da obra).
  onZero: Record<string, string | null>;
  noRegen: boolean;
  encounter: EncounterDef | null;
  shop: ShopDef | null;
};

// ------------------------------------------------------------------ itens e criaturas

export const ITEM_TYPES = ["equipment", "consumable", "container", "quest", "material", "currency"] as const;
export type ItemType = (typeof ITEM_TYPES)[number];
export const ITEM_RARITIES = ["common", "rare", "unique"] as const;
export type ItemRarity = (typeof ITEM_RARITIES)[number];

export type ItemRecord = {
  id: string;
  workId: string;
  key: string;
  name: LocalizedText;
  description: LocalizedText;
  imageMediaId: string | null;
  type: ItemType;
  slot: string | null;
  hands: number;
  size: number;
  weight: number;
  stackable: boolean;
  maxStack: number;
  modifiers: Modifier[];
  useEffects: Effect[];
  consumable: boolean;
  requirements: { key: string; min: number }[];
  containerSlots: number;
  value: number;
  rarity: ItemRarity;
  droppable: boolean;
  position: number;
};
export type Item = Omit<ItemRecord, "workId">;

export type CreatureRecord = {
  id: string;
  workId: string;
  key: string;
  name: LocalizedText;
  description: LocalizedText;
  imageMediaId: string | null;
  // Valores das chaves usadas nas fórmulas de combate (atacante./defensor.).
  stats: Record<string, number>;
  hp: number;
  behavior: "attack" | "flee_low" | "heal_once";
  xp: number;
  loot: LootEntry[];
  position: number;
};
export type Creature = Omit<CreatureRecord, "workId">;

// ------------------------------------------------------------------ modelos de sistema

// Pacote de modelo (importável como os plugins): o sistema, as variáveis e o catálogo de itens e
// criaturas. Dentro do pacote o id de cada item/criatura é a própria chave; ao aplicar numa obra,
// ganham ids novos e toda referência (efeitos, vocações, saque) é trocada.
export const TEMPLATE_FORMAT = "venore-novels-system";
export type SystemTemplatePackage = {
  format: typeof TEMPLATE_FORMAT;
  version: 1;
  key: string;
  name: LocalizedText;
  description: LocalizedText;
  system: GameSystem;
  variables: VariableDefinition[];
  items: Item[];
  creatures: Creature[];
};

export type SystemTemplateRecord = {
  id: string;
  key: string;
  name: LocalizedText;
  description: LocalizedText;
  package: SystemTemplatePackage;
  builtIn: boolean;
  updatedAt: Date;
};
