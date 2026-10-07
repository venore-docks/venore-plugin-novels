import { describe, expect, it } from "vitest";
import { parseProgress, parseReaderState } from "./validation";

describe("parseReaderState (formato antigo)", () => {
  it("aceita estado válido", () => {
    expect(parseReaderState({ sceneId: "a", vars: { x: 1, y: true }, path: ["a"], visitedEndings: [] })).not.toBeNull();
  });
  it("recusa lixo e caminho gigante", () => {
    expect(parseReaderState({ sceneId: "", vars: {}, path: [], visitedEndings: [] })).toBeNull();
    expect(parseReaderState({ sceneId: "a", vars: { x: "s" }, path: [], visitedEndings: [] })).toBeNull();
    expect(parseReaderState({ sceneId: "a", vars: {}, path: Array(501).fill("a"), visitedEndings: [] })).toBeNull();
  });
});

describe("parseProgress (registro de ações)", () => {
  const saved = { v: 2, seed: "abc", log: [{ t: "start", profile: { nome: "Ana" } }, { t: "choose", choiceId: "c1" }], visitedEndings: [], achievements: [] };
  it("aceita o registro e o formato antigo", () => {
    expect(parseProgress(saved)).toEqual({ kind: "saved", saved });
    expect(parseProgress({ sceneId: "a", vars: {}, path: ["a"], visitedEndings: [] })?.kind).toBe("legacy");
  });
  it("recusa ação desconhecida, registro sem início e campos a mais no lugar errado", () => {
    expect(parseProgress({ ...saved, log: [{ t: "start" }, { t: "hack" }] })).toBeNull();
    expect(parseProgress({ ...saved, log: [{ t: "choose", choiceId: "c1" }] })).toBeNull();
    expect(parseProgress({ ...saved, log: [{ t: "start" }, { t: "drop", itemId: "x", quantity: -1 }] })).toBeNull();
    expect(parseProgress({ ...saved, log: Array(4001).fill({ t: "continue" }) })).toBeNull();
  });
});
