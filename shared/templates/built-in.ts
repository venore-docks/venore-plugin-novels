import {
  GAME_MODULES,
  TEMPLATE_FORMAT,
  type AttributeDef,
  type CombatActionDef,
  type Creature,
  type GameModule,
  type GameSystem,
  type Item,
  type ResourceDef,
  type SystemTemplatePackage,
} from "../../contracts/game";
import type { AccentColor, LocalizedText } from "../../contracts/types";
import { emptySystem } from "../engine/system";

// Modelos que vêm com o plugin. São pacotes como os importados (shared/templates/package.ts): o
// admin pode exportar um, mudar e importar com outra chave. Aplicar numa obra copia.

const t = (pt: string, en: string): LocalizedText => ({ "pt-BR": pt, en });

function modules(...on: GameModule[]): Record<GameModule, boolean> {
  return Object.fromEntries(GAME_MODULES.map((module) => [module, on.includes(module)])) as Record<GameModule, boolean>;
}

function resource(key: string, name: LocalizedText, abbr: LocalizedText, color: AccentColor, max: string, extra: Partial<ResourceDef> = {}): ResourceDef {
  return {
    key,
    name,
    abbr,
    color,
    max,
    initial: "max",
    regen: "",
    regenInCombat: false,
    onZero: null,
    onFull: null,
    showInHud: true,
    lowPercent: 25,
    ...extra,
  };
}

function attribute(key: string, name: LocalizedText, abbr: string, initial: number, extra: Partial<AttributeDef> = {}): AttributeDef {
  return {
    key,
    name,
    abbr: { "pt-BR": abbr, en: abbr },
    kind: "stat",
    initial,
    min: 0,
    cap: "",
    showInHud: false,
    training: { enabled: false, threshold: "" },
    ...extra,
  };
}

function action(key: string, name: LocalizedText, damage: string, reduction: string, extra: Partial<CombatActionDef> = {}): CombatActionDef {
  return { key, name, damage, reduction, hit: "", cost: [], trains: null, requires: [], ...extra };
}

function item(key: string, name: LocalizedText, extra: Partial<Item> = {}): Item {
  return {
    id: key,
    key,
    name,
    description: {},
    imageMediaId: null,
    type: "material",
    slot: null,
    hands: 0,
    size: 1,
    weight: 0,
    stackable: false,
    maxStack: 1,
    modifiers: [],
    useEffects: [],
    consumable: false,
    requirements: [],
    containerSlots: 0,
    value: 0,
    rarity: "common",
    droppable: true,
    position: 0,
    ...extra,
  };
}

function creature(key: string, name: LocalizedText, hp: number, stats: Record<string, number>, extra: Partial<Creature> = {}): Creature {
  return { id: key, key, name, description: {}, imageMediaId: null, stats, hp, behavior: "attack", xp: 0, loot: [], position: 0, ...extra };
}

function pkg(key: string, name: LocalizedText, description: LocalizedText, system: GameSystem, items: Item[] = [], creatures: Creature[] = []): SystemTemplatePackage {
  return {
    format: TEMPLATE_FORMAT,
    version: 1,
    key,
    name,
    description,
    system,
    variables: [],
    items: items.map((entry, position) => ({ ...entry, position })),
    creatures: creatures.map((entry, position) => ({ ...entry, position })),
  };
}

const heal = (target: string, amount: string) => [{ kind: "formula" as const, target, operation: "add" as const, formula: amount }];

// ------------------------------------------------------------------ Aventura simples

function simpleAdventure(): SystemTemplatePackage {
  const base = emptySystem();
  return pkg(
    "aventura-simples",
    t("Aventura simples", "Simple adventure"),
    t("Vida e sorte, testes de dados nas escolhas e rolar de novo gastando sorte.", "Health and luck, dice tests on choices and rerolls paid with luck."),
    {
      ...base,
      modules: modules("resources", "dice"),
      resources: [
        resource("vida", t("Vida", "Health"), t("PV", "HP"), "chart-2", "10"),
        resource("sorte", t("Sorte", "Luck"), t("Sorte", "Luck"), "chart-4", "3", { lowPercent: 0 }),
      ],
      dice: { ...base.dice, reroll: { enabled: true, cost: [{ resource: "sorte", amount: "1" }] } },
    },
  );
}

// ------------------------------------------------------------------ RPG de fantasia

function fantasy(): SystemTemplatePackage {
  const base = emptySystem();
  const stats: [string, LocalizedText, string][] = [
    ["forca", t("Força", "Strength"), "FOR"],
    ["destreza", t("Destreza", "Dexterity"), "DES"],
    ["constituicao", t("Constituição", "Constitution"), "CON"],
    ["inteligencia", t("Inteligência", "Intelligence"), "INT"],
    ["sabedoria", t("Sabedoria", "Wisdom"), "SAB"],
    ["carisma", t("Carisma", "Charisma"), "CAR"],
  ];
  return pkg(
    "rpg-fantasia",
    t("RPG de fantasia", "Fantasy RPG"),
    t(
      "Vida e mana, seis atributos, nível com pontos de custo crescente, peso e mochila, áreas de equipamento e combate simples (ataque − defesa).",
      "Health and mana, six attributes, levels with rising point costs, weight and backpack, equipment slots and simple combat (attack − defense).",
    ),
    {
      ...base,
      modules: modules("resources", "attributes", "dice", "inventory", "equipment", "progression", "combat", "effects", "shops", "quests", "achievements", "character", "bestiary"),
      resources: [
        resource("hp", t("Pontos de vida", "Hit points"), t("PV", "HP"), "chart-2", "20 + 5 * nivel + 2 * constituicao", { regen: "1" }),
        resource("mana", t("Mana", "Mana"), t("MP", "MP"), "chart-6", "5 + 3 * nivel + 2 * inteligencia", { regen: "1" }),
      ],
      attributes: stats.map(([key, name, abbr]) => attribute(key, name, abbr, 8, { showInHud: true })),
      derived: [
        { key: "ataque", name: t("Ataque", "Attack"), formula: "forca + nivel", show: true },
        { key: "defesa", name: t("Defesa", "Defense"), formula: "piso(destreza / 2) + piso(constituicao / 2)", show: true },
        { key: "poder_magico", name: t("Poder mágico", "Spell power"), formula: "inteligencia + nivel", show: true },
      ],
      progression: { ...base.progression, pointsPerLevel: 2, attributeCap: "nivel + 12" },
      inventory: {
        weight: { ...base.inventory.weight, enabled: true, name: t("Carga", "Load"), unit: t("kg", "kg"), max: "20 + 2 * forca", overLimit: "penalty", penalty: [{ target: "destreza", amount: -3 }] },
        space: { enabled: true, name: t("Mochila", "Backpack"), base: 8 },
        hands: { enabled: true, name: t("Mãos", "Hands"), count: 2 },
      },
      slots: [
        { key: "cabeca", name: t("Cabeça", "Head"), count: 1 },
        { key: "corpo", name: t("Corpo", "Body"), count: 1 },
        { key: "pernas", name: t("Pernas", "Legs"), count: 1 },
        { key: "pes", name: t("Pés", "Feet"), count: 1 },
        { key: "anel", name: t("Anel", "Ring"), count: 2 },
        { key: "amuleto", name: t("Amuleto", "Amulet"), count: 1 },
        { key: "costas", name: t("Costas", "Back"), count: 1 },
      ],
      combat: {
        ...base.combat,
        hpResource: "hp",
        die: "1d6",
        actions: [
          action("atacar", t("Atacar", "Attack"), "atacante.ataque + dado - defensor.defesa", "0", { hit: "1d20 + atacante.destreza >= 10 + defensor.defesa" }),
          action("magia", t("Bola de fogo", "Fireball"), "atacante.poder_magico + 2 * dado", "0", { cost: [{ resource: "mana", amount: "5" }] }),
        ],
        enemy: { damage: "atacante.ataque + dado - defensor.defesa", reduction: "0", hit: "1d20 + atacante.destreza >= 10 + defensor.defesa" },
        minDamage: 1,
      },
      character: {
        fields: [
          { key: "nome", name: t("Nome", "Name"), kind: "text", options: [], fallback: "Aventureiro" },
          {
            key: "sexo",
            name: t("Sexo", "Sex"),
            kind: "choice",
            options: [
              { value: "feminino", name: t("Feminino", "Female") },
              { value: "masculino", name: t("Masculino", "Male") },
              { value: "outro", name: t("Outro", "Other") },
            ],
            fallback: "outro",
          },
        ],
        vocations: [
          { id: "guerreiro", name: t("Guerreiro", "Warrior"), description: t("Forte e resistente.", "Strong and tough."), imageMediaId: null, values: { forca: 12, constituicao: 11 }, items: [{ itemId: "espada_curta", quantity: 1 }] },
          { id: "mago", name: t("Mago", "Mage"), description: t("Frágil, mas com magia poderosa.", "Frail, but with strong magic."), imageMediaId: null, values: { inteligencia: 13, sabedoria: 11 }, items: [{ itemId: "pocao_vida", quantity: 2 }] },
          { id: "ladino", name: t("Ladino", "Rogue"), description: t("Rápido e esperto.", "Quick and clever."), imageMediaId: null, values: { destreza: 13, carisma: 10 }, items: [{ itemId: "adaga", quantity: 1 }] },
        ],
        startingPoints: 4,
      },
      currency: { mode: "counter", key: "ouro", name: t("Ouro", "Gold"), itemId: null },
      statusEffects: [
        { id: "envenenado", name: t("Envenenado", "Poisoned"), color: "chart-5", duration: 3, perScene: heal("hp", "-2"), modifiers: [] },
        { id: "abencoado", name: t("Abençoado", "Blessed"), color: "chart-4", duration: 5, perScene: [], modifiers: [{ target: "defesa", amount: 2 }] },
      ],
    },
    [
      item("espada_curta", t("Espada curta", "Short sword"), { type: "equipment", hands: 1, weight: 2, modifiers: [{ target: "ataque", amount: 3 }], value: 15 }),
      item("adaga", t("Adaga", "Dagger"), { type: "equipment", hands: 1, weight: 1, modifiers: [{ target: "ataque", amount: 2 }, { target: "destreza", amount: 1 }], value: 8 }),
      item("escudo", t("Escudo de madeira", "Wooden shield"), { type: "equipment", hands: 1, weight: 3, modifiers: [{ target: "defesa", amount: 2 }], value: 10 }),
      item("armadura_couro", t("Armadura de couro", "Leather armor"), { type: "equipment", slot: "corpo", weight: 5, modifiers: [{ target: "defesa", amount: 2 }], value: 20 }),
      item("mochila", t("Mochila de couro", "Leather backpack"), { type: "container", slot: "costas", weight: 1, containerSlots: 6, value: 12 }),
      item("pocao_vida", t("Poção de vida", "Health potion"), { type: "consumable", consumable: true, stackable: true, maxStack: 10, weight: 0.5, useEffects: heal("hp", "10"), value: 5 }),
    ],
    [
      creature("rato", t("Rato gigante", "Giant rat"), 8, { ataque: 3, defesa: 0, destreza: 10, nivel: 1 }, { xp: 25 }),
      creature("goblin", t("Goblin", "Goblin"), 15, { ataque: 5, defesa: 1, destreza: 11, nivel: 2 }, { xp: 60, behavior: "flee_low", loot: [{ itemId: "adaga", chance: 20, quantity: "1" }] }),
    ],
  );
}

// ------------------------------------------------------------------ Venore padrão (planilha)

// As fórmulas do protótipo, com os ajustes do documento: dado 1d10 ÷ 10 no lugar do sorteio de 0
// a 1, redução R/(R+k) (nunca chega a 100%) sobre o HP máximo atual.
function venore(): SystemTemplatePackage {
  const base = emptySystem();
  const reduction = (resist: string) => `(defensor.hp.max * defensor.${resist}) / (defensor.hp.max * defensor.${resist} + 100000)`;
  const damage = (skill: string) => `atacante.${skill} * dado + teto(atacante.nivel * dado * 0.25)`;
  return pkg(
    "venore-padrao",
    t("Venore padrão", "Venore standard"),
    t(
      "As fórmulas da planilha de combate: dano por habilidade × dado, redução por HP × resistência com retorno decrescente, AP para magias.",
      "The combat spreadsheet formulas: skill × die damage, HP × resistance reduction with diminishing returns, AP for spells.",
    ),
    {
      ...base,
      modules: modules("resources", "attributes", "dice", "progression", "combat", "inventory", "equipment", "bestiary"),
      resources: [
        resource("hp", t("Pontos de vida", "Hit points"), t("HP", "HP"), "chart-2", "150 + 15 * (nivel - 1)"),
        resource("ap", t("Pontos de ação", "Action points"), t("AP", "AP"), "chart-6", "50 + 5 * (nivel - 1)", { regen: "5" }),
      ],
      attributes: [
        attribute("resistencia_fisica", t("Resistência física", "Physical resistance"), "RF", 10, { showInHud: true }),
        attribute("resistencia_magica", t("Resistência mágica", "Magic resistance"), "RM", 10, { showInHud: true }),
        attribute("corpo_a_corpo", t("Corpo a corpo", "Melee"), "CC", 10, { kind: "skill", showInHud: true, training: { enabled: true, threshold: "10 + valor" } }),
        attribute("distancia", t("Distância", "Ranged"), "DIS", 10, { kind: "skill", showInHud: true, training: { enabled: true, threshold: "10 + valor" } }),
        attribute("magica", t("Mágica", "Magic"), "MAG", 10, { kind: "skill", showInHud: true, training: { enabled: true, threshold: "10 + valor" } }),
      ],
      progression: { ...base.progression, pointsPerLevel: 3, attributeCap: "nivel + 15" },
      inventory: { ...base.inventory, hands: { enabled: true, name: t("Mãos", "Hands"), count: 2 } },
      slots: [
        { key: "cabeca", name: t("Cabeça", "Head"), count: 1 },
        { key: "corpo", name: t("Corpo", "Body"), count: 1 },
        { key: "pernas", name: t("Pernas", "Legs"), count: 1 },
        { key: "pes", name: t("Pés", "Feet"), count: 1 },
      ],
      combat: {
        ...base.combat,
        hpResource: "hp",
        die: "1d10 / 10",
        actions: [
          action("corpo_a_corpo", t("Atacar (corpo a corpo)", "Melee attack"), damage("corpo_a_corpo"), reduction("resistencia_fisica"), { trains: "corpo_a_corpo" }),
          action("distancia", t("Atirar", "Ranged attack"), damage("distancia"), reduction("resistencia_fisica"), { trains: "distancia" }),
          action("magia", t("Magia", "Spell"), damage("magica"), reduction("resistencia_magica"), { trains: "magica", cost: [{ resource: "ap", amount: "10" }] }),
        ],
        enemy: { damage: damage("corpo_a_corpo"), reduction: reduction("resistencia_fisica"), hit: "" },
        minDamage: 1,
        maxReduction: 0.75,
      },
    },
    [],
    [creature("rato", t("Rato", "Rat"), 40, { corpo_a_corpo: 8, resistencia_fisica: 5, resistencia_magica: 5, nivel: 1 }, { xp: 50 })],
  );
}

// ------------------------------------------------------------------ Tibia-like

function tibiaLike(): SystemTemplatePackage {
  const base = emptySystem();
  const skill = (key: string, name: LocalizedText, abbr: string) =>
    attribute(key, name, abbr, 10, { kind: "skill", training: { enabled: true, threshold: "arred(50 * 1.1 ^ (valor - 10))" } });
  return pkg(
    "tibia-like",
    t("Tibia-like", "Tibia-like"),
    t(
      "HP e mana que sobem por nível, skills que sobem com o uso, curva de XP do Tibia, capacidade em oz e os 10 espaços de equipamento.",
      "Level-based HP and mana, skills trained by use, Tibia XP curve, capacity in oz and the 10 equipment slots.",
    ),
    {
      ...base,
      modules: modules("resources", "attributes", "dice", "inventory", "equipment", "progression", "combat", "shops", "quests", "bestiary"),
      resources: [
        resource("hp", t("Pontos de vida", "Hit points"), t("HP", "HP"), "chart-2", "150 + 5 * (nivel - 1)", { regen: "5" }),
        resource("mana", t("Mana", "Mana"), t("MP", "MP"), "chart-6", "55 + 5 * (nivel - 1)", { regen: "5" }),
      ],
      attributes: [
        skill("club", t("Club fighting", "Club fighting"), "Club"),
        skill("sword", t("Sword fighting", "Sword fighting"), "Sword"),
        skill("axe", t("Axe fighting", "Axe fighting"), "Axe"),
        skill("distance", t("Distance fighting", "Distance fighting"), "Dist"),
        skill("shielding", t("Shielding", "Shielding"), "Shield"),
        attribute("magic_level", t("Magic level", "Magic level"), "ML", 0, { kind: "skill" }),
      ],
      derived: [
        { key: "ataque", name: t("Ataque", "Attack"), formula: "max(club, sword, axe)", show: true },
        { key: "defesa", name: t("Defesa", "Defense"), formula: "shielding", show: true },
      ],
      progression: { ...base.progression, curve: { kind: "formula", formula: "50 / 3 * (n ^ 3 - 6 * n ^ 2 + 17 * n - 12)" }, pointsPerLevel: 0, pointCosts: [{ upTo: null, cost: 1 }] },
      inventory: {
        weight: { ...base.inventory.weight, enabled: true, name: t("Capacidade", "Capacity"), unit: t("oz", "oz"), max: "400 + 10 * (nivel - 1)", overLimit: "block" },
        space: { enabled: true, name: t("Backpack", "Backpack"), base: 0 },
        hands: { enabled: true, name: t("Mãos", "Hands"), count: 2 },
      },
      slots: [
        { key: "helmet", name: t("Capacete", "Helmet"), count: 1 },
        { key: "armor", name: t("Armadura", "Armor"), count: 1 },
        { key: "legs", name: t("Calças", "Legs"), count: 1 },
        { key: "boots", name: t("Botas", "Boots"), count: 1 },
        { key: "colar", name: t("Colar", "Necklace"), count: 1 },
        { key: "ring", name: t("Anel", "Ring"), count: 1 },
        { key: "extra", name: t("Munição", "Ammo"), count: 1 },
        { key: "bp", name: t("Mochila", "Backpack"), count: 1 },
      ],
      combat: {
        ...base.combat,
        hpResource: "hp",
        die: "1d10 / 10",
        actions: [
          action("club", t("Atacar com clava", "Club attack"), "atacante.club * dado + teto(atacante.nivel * dado * 0.25)", "defensor.defesa / (defensor.defesa + 50)", { trains: "club" }),
          action("sword", t("Atacar com espada", "Sword attack"), "atacante.sword * dado + teto(atacante.nivel * dado * 0.25)", "defensor.defesa / (defensor.defesa + 50)", { trains: "sword" }),
        ],
        enemy: { damage: "atacante.ataque * dado", reduction: "defensor.defesa / (defensor.defesa + 50)", hit: "" },
      },
      currency: { mode: "item", key: "moedas", name: t("Gold coins", "Gold coins"), itemId: "gold_coin" },
    },
    [
      item("gold_coin", t("Gold coin", "Gold coin"), { type: "currency", stackable: true, maxStack: 100, size: 1, weight: 0.1 }),
      item("backpack", t("Backpack", "Backpack"), { type: "container", slot: "bp", weight: 18, containerSlots: 20, value: 10 }),
      item("club", t("Clava", "Club"), { type: "equipment", hands: 1, weight: 25, modifiers: [{ target: "club", amount: 7 }], value: 1 }),
      item("leather_helmet", t("Leather helmet", "Leather helmet"), { type: "equipment", slot: "helmet", weight: 22, modifiers: [{ target: "defesa", amount: 1 }], value: 4 }),
      item("health_potion", t("Health potion", "Health potion"), { type: "consumable", consumable: true, stackable: true, maxStack: 100, weight: 1.8, useEffects: heal("hp", "75"), value: 45 }),
    ],
    [creature("rat", t("Rat", "Rat"), 20, { ataque: 8, defesa: 2, nivel: 1 }, { xp: 5, loot: [{ itemId: "gold_coin", chance: 60, quantity: "1d4" }] })],
  );
}

// ------------------------------------------------------------------ Terror com sanidade

function horror(): SystemTemplatePackage {
  const base = emptySystem();
  return pkg(
    "terror-sanidade",
    t("Terror com sanidade", "Horror with sanity"),
    t("Vida e sanidade (zerar leva a uma cena), testes de coragem e efeitos que duram algumas cenas.", "Health and sanity (hitting zero leads to a scene), courage tests and lingering effects."),
    {
      ...base,
      modules: modules("resources", "attributes", "dice", "effects", "achievements"),
      resources: [
        resource("vida", t("Vida", "Health"), t("Vida", "HP"), "chart-2", "10"),
        resource("sanidade", t("Sanidade", "Sanity"), t("San", "San"), "chart-7", "10", { lowPercent: 30 }),
      ],
      attributes: [attribute("coragem", t("Coragem", "Courage"), "COR", 2, { showInHud: true }), attribute("percepcao", t("Percepção", "Perception"), "PER", 2, { showInHud: true })],
      statusEffects: [{ id: "abalado", name: t("Abalado", "Shaken"), color: "chart-7", duration: 3, perScene: heal("sanidade", "-1"), modifiers: [{ target: "coragem", amount: -1 }] }],
    },
  );
}

export const BUILT_IN_TEMPLATES: SystemTemplatePackage[] = [simpleAdventure(), fantasy(), venore(), tibiaLike(), horror()];

export function builtInTemplate(key: string): SystemTemplatePackage | null {
  return BUILT_IN_TEMPLATES.find((template) => template.key === key) ?? null;
}
