import { describe, expect, it } from "vitest";
import { parseChapterGraph } from "./graph-schema";

const sceneA = {
  id: "a",
  label: "A",
  blocks: [{ id: "a1", type: "text", text: { "pt-BR": "Texto" } }],
  isEnding: false,
  endingTitle: {},
  effects: [],
  graphX: 0,
  graphY: 0,
};
const sceneB = { ...sceneA, id: "b", isEnding: true };
const choiceAB = { id: "c1", sceneId: "a", targetSceneId: "b", position: 0, label: { "pt-BR": "Ir" }, conditions: [], effects: [] };

describe("parseChapterGraph", () => {
  it("aceita grafo coerente", () => {
    expect(parseChapterGraph({ startSceneId: "a", scenes: [sceneA, sceneB], choices: [choiceAB] }).ok).toBe(true);
  });
  it("converte cena no formato antigo (texto + lâmina) em blocos", () => {
    const legacy = { ...sceneA, blocks: undefined, body: { "pt-BR": "Olá" }, imageMediaId: "m1" };
    delete (legacy as Record<string, unknown>).blocks;
    const result = parseChapterGraph({ startSceneId: "a", scenes: [legacy, sceneB], choices: [choiceAB] });
    expect(result.ok && result.graph.scenes[0].blocks.map((block) => block.type)).toEqual(["image", "text"]);
  });
  it("recusa bloco desconhecido e bloco repetido", () => {
    const strange = { ...sceneA, blocks: [{ id: "x", type: "video" }] };
    expect(parseChapterGraph({ startSceneId: "a", scenes: [strange, sceneB], choices: [choiceAB] }).ok).toBe(false);
    const repeated = { ...sceneA, blocks: [...sceneA.blocks, ...sceneA.blocks] };
    expect(parseChapterGraph({ startSceneId: "a", scenes: [repeated, sceneB], choices: [choiceAB] }).ok).toBe(false);
  });
  it("recusa formato errado", () => {
    expect(parseChapterGraph({ startSceneId: "a", scenes: "x", choices: [] }).ok).toBe(false);
    expect(parseChapterGraph(null).ok).toBe(false);
  });
  it("recusa escolha pra fora do capítulo, id repetido e início ausente", () => {
    expect(parseChapterGraph({ startSceneId: "a", scenes: [sceneA], choices: [choiceAB] }).ok).toBe(false);
    expect(parseChapterGraph({ startSceneId: "a", scenes: [sceneA, sceneA], choices: [] }).ok).toBe(false);
    expect(parseChapterGraph({ startSceneId: "z", scenes: [sceneA], choices: [] }).ok).toBe(false);
  });
});
