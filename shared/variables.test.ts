import { describe, expect, it } from "vitest";
import type { ChoiceRecord, VariableDefinition } from "../contracts/types";
import { applyEffects, initialVariables, isChoiceAvailable } from "./story-engine";
import { validateVariableDefinitions } from "./story-validation";
import {
  characterSheet,
  derivedVariables,
  describeChanges,
  FREE_CAPACITY_KEY,
  inventoryLoad,
  LOAD_KEY,
  sanitizeVariable,
} from "./variables";

// Mini-ficha de Tibia: HP com teto em hp_max, nível, skills, cap e itens com peso (oz).
const variables: VariableDefinition[] = [
  { key: "hp", label: "HP", type: "number", initial: 150, display: "status", min: 0, maxVariable: "hp_max" },
  { key: "hp_max", label: "HP máximo", type: "number", initial: 150 },
  { key: "level", label: "Level", type: "number", initial: 1, display: "status" },
  { key: "club", label: "Club fighting", type: "number", initial: 10, display: "skill" },
  { key: "fist", label: "Fist fighting", type: "number", initial: 10, display: "skill" },
  { key: "cap", label: "Cap", type: "number", initial: 400, capacity: true, display: "status" },
  { key: "clava", label: "Clava", type: "boolean", initial: false, display: "inventory", weight: 25 },
  { key: "pocao", label: "Poção de vida", type: "number", initial: 2, display: "inventory", weight: 1.8 },
];
const byKey = new Map(variables.map((variable) => [variable.key, variable]));

describe("variáveis do painel do personagem", () => {
  it("HP fica entre o mínimo e o teto de outra variável, e o teto que sobe vale na hora", () => {
    let vars = initialVariables(variables);
    vars = applyEffects(vars, [{ variable: "hp", operation: "add", value: -500 }], byKey);
    expect(vars.hp).toBe(0);
    vars = applyEffects(vars, [{ variable: "hp", operation: "add", value: 999 }], byKey);
    expect(vars.hp).toBe(150);
    // Level up: hp_max sobe e o HP pode subir junto.
    vars = applyEffects(
      vars,
      [
        { variable: "level", operation: "add", value: 1 },
        { variable: "hp_max", operation: "add", value: 5 },
        { variable: "hp", operation: "add", value: 5 },
      ],
      byKey,
    );
    expect(vars).toMatchObject({ level: 2, hp_max: 155, hp: 155 });
  });

  it("carga soma o peso dos itens carregados; condições enxergam carga e espaço livre", () => {
    const vars = initialVariables(variables);
    expect(inventoryLoad(vars, variables)).toBe(3.6);
    const pegarClava = { conditions: [{ variable: FREE_CAPACITY_KEY, operator: "gte", value: 25 }] } as unknown as ChoiceRecord;
    expect(isChoiceAvailable(pegarClava, vars, variables)).toBe(true);
    expect(isChoiceAvailable(pegarClava, { ...vars, cap: 20 }, variables)).toBe(false);
    expect(derivedVariables(variables).map((variable) => variable.key)).toEqual([LOAD_KEY, FREE_CAPACITY_KEY]);
  });

  it("ficha e mudanças mostram só o que é do leitor", () => {
    const before = initialVariables(variables);
    const after = applyEffects(
      before,
      [
        { variable: "clava", operation: "set", value: true },
        { variable: "club", operation: "add", value: 1 },
        { variable: "hp", operation: "add", value: -12 },
        { variable: "hp_max", operation: "add", value: 0 },
      ],
      byKey,
    );
    expect(describeChanges(before, after, variables).map((change) => change.text)).toEqual([
      "HP −12",
      "Club fighting +1",
      "Pegou: Clava",
    ]);
    const sheet = characterSheet(after, variables);
    expect(sheet.status.map((entry) => [entry.label, entry.value, entry.max])).toEqual([
      ["HP", 138, 150],
      ["Level", 1, null],
    ]);
    // A capacidade aparece só na mochila (peso máximo), nunca como status solto.
    expect(sheet.inventory.map((item) => [item.label, item.quantity, item.weight])).toEqual([
      ["Clava", null, 25],
      ["Poção de vida", 2, 3.6],
    ]);
    expect(sheet).toMatchObject({ load: 28.6, capacity: 400 });
  });

  it("validação e limpeza dos campos novos", () => {
    expect(validateVariableDefinitions(variables)).toEqual([]);
    const bad = validateVariableDefinitions([
      { key: "a", label: "A", type: "boolean", initial: false, max: 3 },
      { key: "b", label: "B", type: "number", initial: 0, min: 5, max: 1 },
      { key: "c", label: "C", type: "number", initial: 0, maxVariable: "c" },
      { key: "d", label: "D", type: "number", initial: 0, display: "inventory", weight: -1 },
      { key: "e", label: "E", type: "number", initial: 0, capacity: true },
      { key: "f", label: "F", type: "number", initial: 0, capacity: true },
    ]);
    expect(bad.map((issue) => issue.code)).toEqual([
      "invalid_variable_limits",
      "invalid_variable_limits",
      "invalid_variable_limits",
      "invalid_variable_weight",
      "multiple_capacity",
    ]);
    expect(sanitizeVariable({ key: "x", label: " ", type: "boolean", initial: false, display: "hidden", max: 3, weight: 2 })).toEqual({
      key: "x",
      label: "x",
      type: "boolean",
      initial: false,
    });
  });
});
