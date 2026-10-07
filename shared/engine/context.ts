import type {
  AchievementDef,
  AttributeDef,
  Creature,
  DerivedDef,
  GameModule,
  GameSystem,
  Item,
  QuestDef,
  ResourceDef,
  StatusEffectDef,
} from "../../contracts/game";
import type { ChoiceRecord, Story, StoryScene, VariableDefinition } from "../../contracts/types";
import { normalizeChoiceMechanics, normalizeSceneMechanics, normalizeSystem } from "./system";

// Índices da obra para o motor: montados uma vez por obra (o leitor guarda em useMemo).
export type GameContext = {
  story: Story;
  system: GameSystem;
  locale: string;
  scenes: Map<string, StoryScene>;
  choices: Map<string, ChoiceRecord>;
  choicesByScene: Map<string, ChoiceRecord[]>;
  variables: Map<string, VariableDefinition>;
  resources: Map<string, ResourceDef>;
  attributes: Map<string, AttributeDef>;
  derived: Map<string, DerivedDef>;
  items: Map<string, Item>;
  itemsByKey: Map<string, Item>;
  creatures: Map<string, Creature>;
  statusEffects: Map<string, StatusEffectDef>;
  quests: Map<string, QuestDef>;
  achievements: Map<string, AchievementDef>;
  on: (module: GameModule) => boolean;
  // Cache de nível por XP (a curva é avaliada muitas vezes).
  levelCache: Map<number, number>;
};

export function createContext(story: Story): GameContext {
  const system = normalizeSystem(story.system);
  const scenes = new Map(
    story.scenes.map((scene) => [scene.id, { ...scene, mechanics: normalizeSceneMechanics(scene.mechanics) }]),
  );
  const choices = new Map(
    story.choices.map((choice) => [choice.id, { ...choice, mechanics: normalizeChoiceMechanics(choice.mechanics) }]),
  );
  const choicesByScene = new Map<string, ChoiceRecord[]>();
  for (const choice of choices.values()) {
    const list = choicesByScene.get(choice.sceneId) ?? [];
    list.push(choice);
    choicesByScene.set(choice.sceneId, list);
  }
  for (const list of choicesByScene.values()) list.sort((a, b) => a.position - b.position);
  const on = (module: GameModule) => system.modules[module];
  return {
    story,
    system,
    locale: story.work.defaultLocale,
    scenes,
    choices,
    choicesByScene,
    variables: new Map(story.work.variables.map((variable) => [variable.key, variable])),
    resources: new Map(on("resources") ? system.resources.map((resource) => [resource.key, resource]) : []),
    attributes: new Map(on("attributes") ? system.attributes.map((attribute) => [attribute.key, attribute]) : []),
    derived: new Map(on("attributes") ? system.derived.map((derived) => [derived.key, derived]) : []),
    items: new Map((story.items ?? []).map((item) => [item.id, item])),
    itemsByKey: new Map((story.items ?? []).map((item) => [item.key, item])),
    creatures: new Map((story.creatures ?? []).map((creature) => [creature.id, creature])),
    statusEffects: new Map(on("effects") ? system.statusEffects.map((effect) => [effect.id, effect]) : []),
    quests: new Map(on("quests") ? system.quests.map((quest) => [quest.id, quest]) : []),
    achievements: new Map(on("achievements") ? system.achievements.map((achievement) => [achievement.id, achievement]) : []),
    on,
    levelCache: new Map(),
  };
}

// Contexto sem cenas (editor do sistema, prévia de fórmula, simulador de combate): só as regras.
export function contextFromParts(parts: {
  system: GameSystem;
  variables: VariableDefinition[];
  items?: Item[];
  creatures?: Creature[];
  locale?: string;
}): GameContext {
  const locale = parts.locale ?? "pt-BR";
  return createContext({
    work: {
      id: "preview",
      slug: "preview",
      title: {},
      subtitle: {},
      synopsis: {},
      defaultLocale: locale,
      locales: [locale],
      coverUrl: null,
      coverFocus: null,
      variables: parts.variables,
      tags: [],
    },
    system: parts.system,
    items: parts.items ?? [],
    creatures: parts.creatures ?? [],
    badges: { interactive: {}, textOnly: {}, aiAudio: {} },
    chapters: [],
    scenes: [],
    choices: [],
    cast: [],
    media: {},
    audio: {},
  });
}
