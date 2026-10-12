import { describe, expect, it } from "vitest";
import { buildStory } from "../story-fixture.test-support";
import { BUILT_IN_TEMPLATES } from "../templates/built-in";
import { contextFromParts, createContext } from "./context";
import { compareBuilds, simulateRuns } from "./simulate";

describe("simulador", () => {
  it("partidas aleatórias chegam aos finais e contam as cenas visitadas", () => {
    const ctx = createContext(buildStory());
    const summary = simulateRuns(ctx, 60, "t");
    expect(summary.runs).toBe(60);
    // a -> b -> (capítulo 2) d é o único caminho para um final sem coragem; a-c precisa de coragem.
    expect([...summary.endings.keys()]).toEqual(["d"]);
    expect(summary.visited.get("a")).toBe(60);
    expect(summary.visited.has("c")).toBe(false);
  });

  it("build equilibrada contra pura usa custo crescente (Venore padrão)", () => {
    const venore = BUILT_IN_TEMPLATES.find((template) => template.key === "venore_padrao")!;
    const ctx = contextFromParts({ system: venore.system, variables: [], creatures: venore.creatures });
    const points = compareBuilds(ctx, 5, 20);
    expect(points).toHaveLength(5);
    for (const point of points) {
      expect(point.pure).toBeGreaterThan(0);
      expect(point.balanced).toBeGreaterThan(0);
    }
    expect(points[4].pure).toBeGreaterThan(points[0].pure);
  });
});
