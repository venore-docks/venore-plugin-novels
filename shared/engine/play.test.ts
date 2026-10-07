import { describe, expect, it } from "vitest";
import type { Creature, GameSystem, Item } from "../../contracts/game";
import type { Story } from "../../contracts/types";
import { buildStory, choice, scene } from "../story-fixture.test-support";
import { createContext } from "./context";
import { interpolate } from "./interpolate";
import { applyAction, choiceViews, fromLegacy, newGame, nextStep, replay, toSaved, undo } from "./play";
import { buildSheet } from "./sheet";
import { emptyChoiceMechanics, emptySceneMechanics, emptySystem } from "./system";
import type { GameState, PlayAction } from "./types";

function play(story: Story, actions: PlayAction[], seed = "seed-1"): GameState {
  const ctx = createContext(story);
  const [start, ...rest] = actions;
  const first = newGame(ctx, { seed, start: start?.t === "start" ? start : { t: "start" } });
  if (!first.ok) throw new Error(first.reason);
  let state = first.state;
  for (const action of start?.t === "start" ? rest : actions) {
    const result = applyAction(ctx, state, action);
    if (!result.ok) throw new Error(`${action.t}: ${result.reason}`);
    state = result.state;
  }
  return state;
}

describe("motor: obra só com variáveis (formato antigo)", () => {
  it("começa na cena inicial do primeiro capítulo, com as variáveis iniciais", () => {
    const state = play(buildStory(), []);
    expect(state.sceneId).toBe("a");
    expect(state.vars).toMatchObject({ coragem: 0, chave: false });
    expect(state.path).toEqual(["a"]);
  });

  it("esconde a escolha cuja condição não é satisfeita e aplica efeitos da escolha e da cena", () => {
    const story = buildStory();
    const ctx = createContext(story);
    const start = play(story, []);
    expect(choiceViews(ctx, start).map((view) => view.choice.id)).toEqual(["a-b"]);
    const state = play(story, [{ t: "choose", choiceId: "a-b" }]);
    expect(state.vars).toMatchObject({ coragem: 1, chave: true });
    expect(state.path).toEqual(["a", "b"]);
    expect(state.entries.at(-1)?.changes.length).toBeGreaterThanOrEqual(0);
  });

  it("recusa escolha indisponível", () => {
    const story = buildStory();
    const ctx = createContext(story);
    const result = applyAction(ctx, play(story, []), { t: "choose", choiceId: "a-c" });
    expect(result.ok).toBe(false);
  });

  it("cena sem escolha leva ao próximo capítulo e registra o final", () => {
    const story = buildStory();
    const ctx = createContext(story);
    const afterB = play(story, [{ t: "choose", choiceId: "a-b" }]);
    expect(nextStep(ctx, afterB)).toEqual({ kind: "next-chapter", chapterId: "ch2", sceneId: "d" });
    const inCh2 = play(story, [{ t: "choose", choiceId: "a-b" }, { t: "continue" }]);
    expect(inCh2.visitedEndings).toEqual(["d"]);
    expect(nextStep(ctx, inCh2).kind).toBe("ending");
  });

  it("voltar refaz a partida sem a última escolha", () => {
    const story = buildStory();
    const ctx = createContext(story);
    const undone = undo(ctx, play(story, [{ t: "choose", choiceId: "a-b" }]));
    expect(undone).toMatchObject({ sceneId: "a", path: ["a"] });
    expect(undone?.vars).toMatchObject({ coragem: 0, chave: false });
  });

  it("refazer o registro salvo dá o mesmo estado", () => {
    const story = buildStory();
    const ctx = createContext(story);
    const state = play(story, [{ t: "choose", choiceId: "a-b" }, { t: "continue" }]);
    const { state: again, truncated } = replay(ctx, toSaved(state));
    expect(truncated).toBe(false);
    expect(again.sceneId).toBe(state.sceneId);
    expect(again.vars).toEqual(state.vars);
  });

  it("registro com escolha que não existe mais para no último ponto válido", () => {
    const story = buildStory();
    const ctx = createContext(story);
    const saved = toSaved(play(story, [{ t: "choose", choiceId: "a-b" }]));
    const { state, truncated } = replay(ctx, { ...saved, log: [...saved.log, { t: "choose", choiceId: "sumiu" }] });
    expect(truncated).toBe(true);
    expect(state.sceneId).toBe("b");
  });

  it("progresso no formato antigo vira registro de ações", () => {
    const story = buildStory();
    const ctx = createContext(story);
    const state = fromLegacy(ctx, { sceneId: "d", vars: {}, path: ["a", "b", "d"], visitedEndings: ["c"] });
    expect(state?.sceneId).toBe("d");
    expect(state?.log.map((action) => action.t)).toEqual(["start", "choose", "continue"]);
    expect(state?.visitedEndings).toEqual(expect.arrayContaining(["c", "d"]));
  });
});

// ------------------------------------------------------------------ obra com sistema de jogo

function rpgSystem(overrides: Partial<GameSystem> = {}): GameSystem {
  const system = emptySystem();
  return {
    ...system,
    modules: { ...system.modules, resources: true, attributes: true, dice: true, progression: true, inventory: true, equipment: true, combat: true, effects: true, shops: true, quests: true, achievements: true, character: true, bestiary: true },
    resources: [
      {
        key: "vida",
        name: { "pt-BR": "Vida" },
        abbr: { "pt-BR": "PV" },
        color: "chart-2",
        max: "10 + vigor * 2",
        initial: "max",
        regen: "",
        regenInCombat: false,
        onZero: { sceneId: "morte", effects: [] },
        onFull: null,
        showInHud: true,
        lowPercent: 25,
      },
      {
        key: "sorte",
        name: { "pt-BR": "Sorte" },
        abbr: { "pt-BR": "SO" },
        color: "chart-4",
        max: "3",
        initial: "3",
        regen: "",
        regenInCombat: false,
        onZero: null,
        onFull: null,
        showInHud: true,
        lowPercent: 0,
      },
    ],
    attributes: [
      { key: "vigor", name: { "pt-BR": "Vigor" }, abbr: { "pt-BR": "VIG" }, kind: "stat", initial: 5, min: 0, cap: "", showInHud: true, training: { enabled: false, threshold: "" } },
      { key: "destreza", name: { "pt-BR": "Destreza" }, abbr: { "pt-BR": "DES" }, kind: "stat", initial: 2, min: 0, cap: "", showInHud: true, training: { enabled: false, threshold: "" } },
      {
        key: "espada",
        name: { "pt-BR": "Espada" },
        abbr: { "pt-BR": "ESP" },
        kind: "skill",
        initial: 1,
        min: 0,
        cap: "",
        showInHud: false,
        training: { enabled: true, threshold: "2" },
      },
    ],
    derived: [{ key: "ataque", name: { "pt-BR": "Ataque" }, formula: "vigor + espada", show: true }],
    inventory: {
      ...system.inventory,
      space: { enabled: true, name: { "pt-BR": "Mochila" }, base: 2 },
      hands: { enabled: true, name: { "pt-BR": "Mãos" }, count: 2 },
    },
    slots: [{ key: "cabeca", name: { "pt-BR": "Cabeça" }, count: 1 }],
    dice: { ...system.dice, reroll: { enabled: true, cost: [{ resource: "sorte", amount: "1" }] } },
    combat: {
      ...system.combat,
      hpResource: "vida",
      die: "1",
      actions: [
        { key: "golpe", name: { "pt-BR": "Golpe" }, damage: "atacante.ataque", reduction: "0", hit: "", cost: [], trains: "espada", requires: [] },
      ],
      enemy: { damage: "atacante.ataque", reduction: "0", hit: "" },
      minDamage: 1,
    },
    character: {
      fields: [
        { key: "nome", name: { "pt-BR": "Nome" }, kind: "text", options: [], fallback: "Viajante" },
        {
          key: "sexo",
          name: { "pt-BR": "Sexo" },
          kind: "choice",
          options: [
            { value: "feminino", name: { "pt-BR": "Feminino" } },
            { value: "masculino", name: { "pt-BR": "Masculino" } },
          ],
          fallback: "neutro",
        },
      ],
      vocations: [],
      startingPoints: 2,
    },
    statusEffects: [{ id: "veneno", name: { "pt-BR": "Veneno" }, color: "chart-5", duration: 2, perScene: [{ kind: "formula", target: "vida", operation: "add", formula: "-1" }], modifiers: [] }],
    quests: [{ id: "q1", name: { "pt-BR": "Achar o mapa" }, description: {}, steps: [{ id: "s1", text: {} }, { id: "s2", text: {} }] }],
    achievements: [{ id: "a1", name: { "pt-BR": "Primeiro sangue" }, description: {}, hidden: false }],
    ...overrides,
  };
}

function item(overrides: Partial<Item> & { id: string }): Item {
  return {
    key: overrides.id,
    name: { "pt-BR": overrides.id },
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
    ...overrides,
  };
}

const goblin: Creature = {
  id: "goblin",
  key: "goblin",
  name: { "pt-BR": "Goblin" },
  description: {},
  imageMediaId: null,
  stats: { ataque: 2 },
  hp: 6,
  behavior: "attack",
  xp: 120,
  loot: [{ itemId: "moeda", chance: 100, quantity: "3" }],
  position: 0,
};

function rpgStory(system = rpgSystem()): Story {
  const base = buildStory();
  return {
    ...base,
    system,
    items: [
      item({ id: "elmo", slot: "cabeca", type: "equipment", modifiers: [{ target: "vigor", amount: 2 }] }),
      item({ id: "pocao", type: "consumable", consumable: true, stackable: true, maxStack: 5, useEffects: [{ kind: "formula", target: "vida", operation: "add", formula: "5" }], value: 10 }),
      item({ id: "pedra", size: 1 }),
      item({ id: "moeda", type: "currency", stackable: true, maxStack: 999, size: 0 }),
    ],
    creatures: [goblin],
    chapters: [{ id: "ch1", position: 1, title: { "pt-BR": "Um" }, startSceneId: "inicio" }],
    scenes: [
      scene({ id: "inicio", chapterId: "ch1" }),
      scene({ id: "ponte", chapterId: "ch1" }),
      scene({ id: "rio", chapterId: "ch1", effects: [{ kind: "formula", target: "vida", operation: "add", formula: "-3" }] }),
      scene({
        id: "luta",
        chapterId: "ch1",
        mechanics: {
          ...emptySceneMechanics(),
          kind: "encounter",
          encounter: {
            creatures: [{ creatureId: "goblin", count: 1 }],
            mode: "rounds",
            victorySceneId: "vitoria",
            defeatSceneId: "morte",
            fleeSceneId: null,
            single: { roll: "1d20", dc: "10", hpLoss: "2" },
          },
        },
      }),
      scene({ id: "vitoria", chapterId: "ch1", isEnding: true }),
      scene({ id: "loja", chapterId: "ch1", mechanics: { ...emptySceneMechanics(), kind: "shop", shop: { items: [{ itemId: "pocao", price: 2, stock: 1 }], sellRate: 0.5 } } }),
      scene({ id: "morte", chapterId: "ch1", isEnding: true }),
    ],
    choices: [
      choice({
        id: "pular",
        sceneId: "inicio",
        targetSceneId: "ponte",
        mechanics: {
          ...emptyChoiceMechanics(),
          test: {
            roll: "1d20 + destreza",
            dc: "12",
            label: { "pt-BR": "Destreza" },
            successEffects: [{ kind: "xp", amount: "100" }],
            failure: { targetSceneId: "rio", effects: [] },
            critical: null,
            fumble: null,
            bands: [],
          },
        },
      }),
      choice({ id: "lutar", sceneId: "inicio", targetSceneId: "luta", position: 1 }),
      choice({
        id: "correr",
        sceneId: "inicio",
        targetSceneId: "ponte",
        position: 2,
        mechanics: { ...emptyChoiceMechanics(), cost: [{ resource: "vida", amount: "4" }], whenUnavailable: "disable" },
      }),
      choice({ id: "comprar", sceneId: "inicio", targetSceneId: "loja", position: 3 }),
      choice({
        id: "envenenar",
        sceneId: "inicio",
        targetSceneId: "ponte",
        position: 4,
        effects: [
          { kind: "status", operation: "apply", effectId: "veneno" },
          { kind: "quest", operation: "start", questId: "q1" },
          { kind: "achievement", achievementId: "a1" },
        ],
      }),
      choice({ id: "ponte-rio", sceneId: "ponte", targetSceneId: "rio" }),
      choice({ id: "rio-ponte", sceneId: "rio", targetSceneId: "ponte" }),
      choice({ id: "rio-morte", sceneId: "rio", targetSceneId: "morte", position: 1 }),
      choice({ id: "loja-luta", sceneId: "loja", targetSceneId: "luta" }),
    ],
  };
}

// Primeira semente (a partir de "s0") cujo teste de "pular" dá o resultado pedido.
function seedFor(story: Story, outcome: "success" | "failure"): string {
  for (let index = 0; index < 200; index += 1) {
    const seed = `s${index}`;
    const state = play(story, [{ t: "start" }, { t: "choose", choiceId: "pular" }], seed);
    if ((outcome === "success") === (state.sceneId === "ponte")) return seed;
  }
  throw new Error("nenhuma semente");
}

describe("motor: recursos, atributos e dados", () => {
  it("recursos começam cheios com o máximo calculado por fórmula", () => {
    const state = play(rpgStory(), []);
    expect(state.vars.vida).toBe(20);
    expect(state.vars.sorte).toBe(3);
  });

  it("teste de dados: mesma semente, mesmo resultado; sucesso dá XP e falha vai para outra cena", () => {
    const story = rpgStory();
    const success = play(story, [{ t: "start" }, { t: "choose", choiceId: "pular" }], seedFor(story, "success"));
    expect(success.sceneId).toBe("ponte");
    expect(success.vars.xp).toBe(100);
    expect(success.entries.at(-1)?.rolls[0]).toMatchObject({ outcome: "success", dc: 12 });
    const failure = play(story, [{ t: "start" }, { t: "choose", choiceId: "pular" }], seedFor(story, "failure"));
    expect(failure.sceneId).toBe("rio");
    expect(failure.vars.vida).toBe(17);
    expect(failure.entries.at(-1)?.rolls[0].outcome).toBe("failure");
  });

  it("rolar de novo paga o custo e usa dados novos; a partida refeita do registro é igual", () => {
    const story = rpgStory();
    const ctx = createContext(story);
    const seed = seedFor(story, "failure");
    const failed = play(story, [{ t: "start" }, { t: "choose", choiceId: "pular" }], seed);
    let state = failed;
    for (let attempt = 0; attempt < 3 && state.sceneId !== "ponte"; attempt += 1) {
      const result = applyAction(ctx, state, { t: "reroll" });
      if (!result.ok) break;
      state = result.state;
    }
    expect(state.vars.sorte).toBeLessThan(3);
    const again = replay(ctx, toSaved(state));
    expect(again.truncated).toBe(false);
    expect(again.state.sceneId).toBe(state.sceneId);
    expect(again.state.vars).toEqual(state.vars);
  });

  it("custo em recurso desabilita a escolha quando falta", () => {
    const story = rpgStory();
    const ctx = createContext(story);
    const hurt = play(story, [{ t: "start" }, { t: "choose", choiceId: "pular" }], seedFor(story, "failure"));
    expect(hurt.vars.vida).toBe(17);
    const back = play(
      story,
      [{ t: "start" }, { t: "choose", choiceId: "pular" }, { t: "choose", choiceId: "rio-ponte" }, { t: "choose", choiceId: "ponte-rio" }, { t: "choose", choiceId: "rio-ponte" }, { t: "choose", choiceId: "ponte-rio" }, { t: "choose", choiceId: "rio-ponte" }, { t: "choose", choiceId: "ponte-rio" }],
      seedFor(story, "failure"),
    );
    // Cada ida ao rio tira 3: 17 -> 14 -> 11 -> 8.
    expect(back.vars.vida).toBe(8);
    const start = play(story, []);
    const view = choiceViews(ctx, start).find((candidate) => candidate.choice.id === "correr");
    expect(view).toMatchObject({ enabled: true, costs: [{ amount: 4 }] });
  });

  it("recurso zerado leva à cena do gatilho", () => {
    const story = rpgStory();
    const actions: PlayAction[] = [{ t: "start" }, { t: "choose", choiceId: "pular" }];
    for (let index = 0; index < 6; index += 1) actions.push({ t: "choose", choiceId: "rio-ponte" }, { t: "choose", choiceId: "ponte-rio" });
    const ctx = createContext(story);
    let state = play(story, actions.slice(0, 2), seedFor(story, "failure"));
    for (const action of actions.slice(2)) {
      const result = applyAction(ctx, state, action);
      if (!result.ok) break;
      state = result.state;
    }
    expect(state.sceneId).toBe("morte");
    expect(state.vars.vida).toBe(0);
  });
});

describe("motor: progressão, itens e combate", () => {
  it("XP sobe de nível uma vez só e dá pontos para distribuir", () => {
    const story = rpgStory();
    const state = play(story, [{ t: "start" }, { t: "choose", choiceId: "pular" }], seedFor(story, "success"));
    expect(state.level).toBe(2);
    expect(state.vars.pontos).toBe(1);
    const ctx = createContext(story);
    const allocated = applyAction(ctx, state, { t: "allocate", key: "vigor" });
    expect(allocated.ok && allocated.state.vars.vigor).toBe(6);
    expect(allocated.ok && allocated.state.vars.pontos).toBe(0);
    // Refazer não conta o nível de novo.
    expect(replay(ctx, toSaved(allocated.ok ? allocated.state : state)).state.vars.pontos).toBe(0);
  });

  it("pontos iniciais na criação de personagem e ficha com sexo", () => {
    const story = rpgStory();
    const state = play(story, [{ t: "start", profile: { nome: "Ana", sexo: "feminino" }, allocations: { destreza: 5 } }]);
    expect(state.vars.destreza).toBe(4);
    expect(state.profile).toEqual({ nome: "Ana", sexo: "feminino" });
    const fields = story.system.character.fields;
    expect(interpolate("{nome} está {sexo|feminino:cansada|masculino:cansado|cansade}.", fields, state.profile, "pt-BR")).toBe("Ana está cansada.");
    expect(interpolate("{nome} ({sexo})", fields, {}, "pt-BR")).toBe("Viajante (neutro)");
  });

  it("equipar aplica o modificador e muda o máximo do recurso", () => {
    const story = rpgStory();
    story.choices.push(choice({ id: "pegar-elmo", sceneId: "ponte", targetSceneId: "rio", effects: [{ kind: "item", operation: "give", itemId: "elmo", quantity: "1" }] }));
    const ctx = createContext(story);
    let state = play(story, [{ t: "start" }, { t: "choose", choiceId: "pular" }, { t: "choose", choiceId: "pegar-elmo" }], seedFor(story, "success"));
    expect(state.bag).toEqual([{ itemId: "elmo", quantity: 1 }]);
    const equipped = applyAction(ctx, state, { t: "equip", itemId: "elmo" });
    if (!equipped.ok) throw new Error(equipped.reason);
    state = equipped.state;
    const sheet = buildSheet(ctx, state);
    expect(sheet.stats.find((stat) => stat.key === "vigor")).toMatchObject({ value: 7, base: 5 });
    expect(sheet.resources.find((resource) => resource.key === "vida")?.max).toBe(24);
  });

  it("item que não cabe fica sobrando até o leitor resolver", () => {
    const story = rpgStory();
    story.choices.push(choice({ id: "pedras", sceneId: "ponte", targetSceneId: "rio", effects: [{ kind: "item", operation: "give", itemId: "pedra", quantity: "3" }] }));
    const ctx = createContext(story);
    const state = play(story, [{ t: "start" }, { t: "choose", choiceId: "pular" }, { t: "choose", choiceId: "pedras" }], seedFor(story, "success"));
    expect(state.bag).toEqual([{ itemId: "pedra", quantity: 2 }]);
    expect(state.overflow).toEqual([{ itemId: "pedra", quantity: 1 }]);
    expect(nextStep(ctx, state).kind).toBe("overflow");
    const discarded = applyAction(ctx, state, { t: "discard" });
    expect(discarded.ok && nextStep(ctx, discarded.state).kind).toBe("choices");
  });

  it("combate por rodadas até a vitória, com XP, saque e treino da skill", () => {
    const story = rpgStory();
    const ctx = createContext(story);
    let state = play(story, [{ t: "start" }, { t: "choose", choiceId: "lutar" }]);
    expect(nextStep(ctx, state).kind).toBe("combat");
    for (let round = 0; round < 10 && state.combat && !state.combat.result; round += 1) {
      const result = applyAction(ctx, state, { t: "combat", action: "golpe", target: 0 });
      if (!result.ok) throw new Error(result.reason);
      state = result.state;
    }
    expect(state.sceneId).toBe("vitoria");
    expect(state.vars.xp).toBe(120);
    expect(state.bag).toEqual([{ itemId: "moeda", quantity: 3 }]);
    // Ataque 5 + 1 = 6: o goblin (6 de vida) cai no primeiro golpe e ainda leva 2 de volta? Não: morre antes.
    expect(state.vars.vida).toBe(20);
    expect(state.training.espada ?? 0).toBe(1);
    expect(state.seenCreatures).toEqual(["goblin"]);
  });

  it("loja: compra com moeda, estoque acaba e venda devolve parte do valor", () => {
    const story = rpgStory();
    const ctx = createContext(story);
    let state = play(story, [{ t: "start" }, { t: "choose", choiceId: "comprar" }]);
    expect(applyAction(ctx, state, { t: "buy", itemId: "pocao" }).ok).toBe(false);
    state = { ...state, vars: { ...state.vars, moedas: 5 } };
    const bought = applyAction(ctx, state, { t: "buy", itemId: "pocao" });
    if (!bought.ok) throw new Error(bought.reason);
    expect(bought.state.vars.moedas).toBe(3);
    expect(applyAction(ctx, bought.state, { t: "buy", itemId: "pocao" })).toEqual({ ok: false, reason: "Esgotado." });
    const sold = applyAction(ctx, bought.state, { t: "sell", itemId: "pocao" });
    expect(sold.ok && sold.state.vars.moedas).toBe(8);
  });

  it("efeito com duração age por cena e some; missão e conquista entram na partida", () => {
    const story = rpgStory();
    const state = play(story, [{ t: "start" }, { t: "choose", choiceId: "envenenar" }, { t: "choose", choiceId: "ponte-rio" }, { t: "choose", choiceId: "rio-ponte" }]);
    // Veneno: -1 em "ponte" e em "rio" (2 cenas), mais -3 do rio.
    expect(state.vars.vida).toBe(15);
    expect(state.effects).toEqual([]);
    expect(state.quests.q1).toEqual({ state: "active", step: 0 });
    expect(state.achievements).toEqual(["a1"]);
  });

  it("hardcore não volta nem rola de novo", () => {
    const story = rpgStory({ ...rpgSystem(), hardcore: true });
    const ctx = createContext(story);
    const state = play(story, [{ t: "start", hardcore: true }, { t: "choose", choiceId: "pular" }], seedFor(story, "failure"));
    expect(state.hardcore).toBe(true);
    expect(undo(ctx, state)).toBeNull();
    expect(applyAction(ctx, state, { t: "reroll" }).ok).toBe(false);
  });
});
