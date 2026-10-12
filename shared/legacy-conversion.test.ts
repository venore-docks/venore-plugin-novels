import { describe, expect, it } from "vitest";
import type { VariableDefinition } from "../contracts/types";
import { emptySystem } from "./engine/system";
import { canConvert, planLegacyConversion, resolveItemRefs } from "./legacy-conversion";

const variables: VariableDefinition[] = [
  { key: "hp", label: "HP", type: "number", initial: 150, display: "status", min: 0, maxVariable: "hp_max" },
  { key: "hp_max", label: "HP máximo", type: "number", initial: 150 },
  { key: "cap", label: "Cap", type: "number", initial: 400, capacity: true },
  { key: "clava", label: "Clava", type: "boolean", initial: false, display: "inventory", weight: 25 },
  { key: "pocao", label: "Poção", type: "number", initial: 2, display: "inventory", weight: 1.8 },
  { key: "coragem", label: "Coragem", type: "number", initial: 0 },
];

describe("conversão das variáveis antigas", () => {
  it("barra vira recurso, inventário vira item e capacidade vira peso máximo", () => {
    expect(canConvert(variables)).toBe(true);
    const plan = planLegacyConversion({
      variables,
      system: emptySystem(),
      locale: "pt-BR",
      existingItemKeys: [],
      scenes: [{ id: "s1", effects: [{ variable: "pocao", operation: "add", value: -1 }, { variable: "coragem", operation: "add", value: 1 }] }],
      choices: [{ id: "c1", conditions: [{ variable: "clava", operator: "eq", value: true }], effects: [{ variable: "clava", operation: "set", value: true }] }],
    });
    expect(plan.summary).toEqual({ resources: ["hp"], items: ["clava", "pocao"], capacity: "cap" });
    expect(plan.system.resources[0]).toMatchObject({ key: "hp", max: "hp_max", initial: "150" });
    expect(plan.system.inventory.weight).toMatchObject({ enabled: true, max: "cap" });
    expect(plan.items.find((item) => item.key === "clava")).toMatchObject({ weight: 25, stackable: false });
    expect(plan.variables.map((variable) => variable.key)).toEqual(["hp_max", "cap", "coragem"]);
    expect(plan.scenes[0].effects).toEqual([
      { kind: "item", operation: "take", itemId: "key:pocao", quantity: "1" },
      { variable: "coragem", operation: "add", value: 1 },
    ]);
    expect(plan.choices[0].conditions).toEqual([{ kind: "item", itemId: "key:clava", min: 1 }]);
    expect(plan.startingItems).toEqual([{ key: "pocao", quantity: 2 }]);
    expect(resolveItemRefs(plan.choices[0], new Map([["clava", "id-clava"]])).effects).toEqual([{ kind: "item", operation: "give", itemId: "id-clava", quantity: "1" }]);
  });
});
