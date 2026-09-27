import { describe, expect, it } from "vitest";
import { parseChapterGraph } from "./graph-schema";

const sceneA = {
  id: "a",
  label: "A",
  imageMediaId: null,
  body: { "pt-BR": "Texto" },
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
