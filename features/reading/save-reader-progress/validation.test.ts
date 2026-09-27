import { describe, expect, it } from "vitest";
import { parseReaderState } from "./validation";

describe("parseReaderState", () => {
  it("aceita estado válido", () => {
    expect(parseReaderState({ sceneId: "a", vars: { x: 1, y: true }, path: ["a"], visitedEndings: [] })).not.toBeNull();
  });
  it("recusa lixo e caminho gigante", () => {
    expect(parseReaderState({ sceneId: "", vars: {}, path: [], visitedEndings: [] })).toBeNull();
    expect(parseReaderState({ sceneId: "a", vars: { x: "s" }, path: [], visitedEndings: [] })).toBeNull();
    expect(parseReaderState({ sceneId: "a", vars: {}, path: Array(501).fill("a"), visitedEndings: [] })).toBeNull();
  });
});
