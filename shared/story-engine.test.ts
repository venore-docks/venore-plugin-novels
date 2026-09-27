import { describe, expect, it } from "vitest";
import {
  applyEffects,
  choose,
  continueToNextChapter,
  evaluateCondition,
  indexStory,
  nextStep,
  reconcileState,
  startStory,
  undoLastChoice,
} from "./story-engine";
import { buildStory } from "./story-fixture.test-support";

describe("story-engine", () => {
  it("começa na cena inicial do capítulo de menor posição, com as variáveis iniciais", () => {
    const story = buildStory();
    const state = startStory(story, indexStory(story));
    expect(state).toEqual({ sceneId: "a", vars: { coragem: 0, chave: false }, path: ["a"], visitedEndings: [] });
  });

  it("esconde a escolha cuja condição não é satisfeita", () => {
    const story = buildStory();
    const index = indexStory(story);
    const state = startStory(story, index)!;
    const step = nextStep(story, index, state);
    expect(step.kind).toBe("choices");
    if (step.kind === "choices") expect(step.choices.map((c) => c.id)).toEqual(["a-b"]);
  });

  it("aplica efeitos da escolha e da cena de destino", () => {
    const story = buildStory();
    const index = indexStory(story);
    const result = choose(story, index, startStory(story, index)!, "a-b");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.vars).toEqual({ coragem: 1, chave: true });
      expect(result.state.path).toEqual(["a", "b"]);
    }
  });

  it("recusa escolha indisponível", () => {
    const story = buildStory();
    const index = indexStory(story);
    expect(choose(story, index, startStory(story, index)!, "a-c")).toEqual({ ok: false, reason: "choice_unavailable" });
  });

  it("cena sem escolha avança pro próximo capítulo e registra o final alcançado", () => {
    const story = buildStory();
    const index = indexStory(story);
    const afterB = choose(story, index, startStory(story, index)!, "a-b");
    if (!afterB.ok) throw new Error("esperava avançar");
    expect(nextStep(story, index, afterB.state)).toEqual({ kind: "next-chapter", chapterId: "ch2", sceneId: "d" });
    const inCh2 = continueToNextChapter(story, index, afterB.state);
    expect(inCh2.ok && inCh2.state.visitedEndings).toEqual(["d"]);
    if (inCh2.ok) expect(nextStep(story, index, inCh2.state).kind).toBe("ending");
  });

  it("voltar para a última escolha recalcula as variáveis", () => {
    const story = buildStory();
    const index = indexStory(story);
    const afterB = choose(story, index, startStory(story, index)!, "a-b");
    if (!afterB.ok) throw new Error("esperava avançar");
    const undone = undoLastChoice(story, index, afterB.state);
    expect(undone).toMatchObject({ sceneId: "a", vars: { coragem: 0, chave: false }, path: ["a"] });
  });

  it("estado salvo de versão antiga (cena apagada) recomeça preservando finais", () => {
    const story = buildStory();
    const index = indexStory(story);
    const state = reconcileState(story, index, { sceneId: "sumiu", vars: {}, path: ["sumiu"], visitedEndings: ["c", "x"] });
    expect(state).toMatchObject({ sceneId: "a", visitedEndings: ["c"] });
  });

  it("descarta variável salva de tipo errado", () => {
    const story = buildStory();
    const index = indexStory(story);
    const state = reconcileState(story, index, { sceneId: "b", vars: { coragem: "muito" as never, chave: true }, path: ["a", "b"], visitedEndings: [] });
    expect(state?.vars).toEqual({ coragem: 0, chave: true });
  });

  it("condições numéricas e booleanas", () => {
    expect(evaluateCondition({ variable: "x", operator: "lt", value: 3 }, { x: 2 })).toBe(true);
    expect(evaluateCondition({ variable: "x", operator: "gt", value: 3 }, { x: true })).toBe(false);
    expect(evaluateCondition({ variable: "y", operator: "eq", value: true }, {})).toBe(false);
  });

  it("efeito em variável inexistente é ignorado", () => {
    const vars = applyEffects({ a: 1 }, [{ variable: "b", operation: "set", value: 2 }], new Map());
    expect(vars).toEqual({ a: 1 });
  });
});
