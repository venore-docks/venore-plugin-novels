import { describe, expect, it } from "vitest";
import { checkFormula, evaluateBoolean, evaluateFormula, evaluateNumber, formulaReferences, type DiceRoll, type FormulaScope } from "./formula";
import { dieAt, randomAt } from "./rng";

const values: Record<string, number | boolean | string> = { forca: 12, nivel: 3, "hp.max": 40, vivo: true, sexo: "feminino" };
const scope: FormulaScope = {
  get: (name) => values[name],
  call: (name, args) => (name === "tem" ? (args[0] === "corda" ? 2 : 0) : undefined),
};

describe("fórmulas", () => {
  it("aritmética com precedência, potência à direita e menos unário", () => {
    expect(evaluateFormula("2 + 3 * 4", scope)).toBe(14);
    expect(evaluateFormula("(2 + 3) * 4", scope)).toBe(20);
    expect(evaluateFormula("2 ^ 3 ^ 2", scope)).toBe(512);
    expect(evaluateFormula("-2 ^ 2", scope)).toBe(-4);
    expect(evaluateFormula("7 % 3", scope)).toBe(1);
    expect(evaluateFormula("1 / 0", scope)).toBe(0);
    expect(evaluateFormula("2.5 * 2", scope)).toBe(5);
  });

  it("nomes com ponto, palavras e funções do contexto", () => {
    expect(evaluateFormula("forca + nivel * 2", scope)).toBe(18);
    expect(evaluateFormula("hp.max / 2", scope)).toBe(20);
    expect(evaluateBoolean("forca >= 10 e não (nivel > 5)", scope)).toBe(true);
    expect(evaluateBoolean("forca < 10 ou vivo", scope)).toBe(true);
    expect(evaluateBoolean('sexo = "feminino"', scope)).toBe(true);
    expect(evaluateFormula("tem(\"corda\")", scope)).toBe(2);
  });

  it("funções embutidas", () => {
    expect(evaluateFormula("min(3, 1, 2) + max(4, 9)", scope)).toBe(10);
    expect(evaluateFormula("arred(2.345, 2)", scope)).toBe(2.35);
    expect(evaluateFormula("piso(2.9) + teto(2.1) + abs(-1)", scope)).toBe(6);
    expect(evaluateFormula("limitar(50, 0, 10)", scope)).toBe(10);
    expect(evaluateFormula("se(nivel > 2, 100, 0)", scope)).toBe(100);
  });

  it("dados usam o rolador do escopo e avisam cada rolagem", () => {
    const rolls: DiceRoll[] = [];
    const sequence = [6, 2, 5, 1];
    const dice: FormulaScope = { ...scope, roll: () => sequence.shift()!, onRoll: (roll) => rolls.push(roll) };
    expect(evaluateFormula("4d6k3 + forca", dice)).toBe(13 + 12);
    expect(rolls[0]).toMatchObject({ notation: "4d6k3", rolls: [6, 2, 5, 1], kept: [6, 5, 2] });
    expect(evaluateFormula("d20", { ...scope, roll: () => 17 })).toBe(17);
    // Sem rolador, o dado vale a média.
    expect(evaluateFormula("2d6", scope)).toBe(7);
  });

  it("recusa fórmula malformada com mensagem em português", () => {
    for (const bad of ["2 +", "(1 + 2", "1 $ 2", "0d6", "1d1", "4d6k5", "x".repeat(501)]) {
      expect(checkFormula(bad).ok).toBe(false);
    }
    expect(evaluateNumber("desconhecido + 1", scope, -1)).toBe(-1);
    expect(evaluateNumber("", scope, 7)).toBe(7);
  });

  it("lista nomes, funções e dados usados", () => {
    const parsed = checkFormula("forca + tem(\"corda\") + 1d6");
    if (!parsed.ok) throw new Error(parsed.message);
    const refs = formulaReferences(parsed.node);
    expect([...refs.names]).toEqual(["forca"]);
    expect([...refs.functions]).toEqual(["tem"]);
    expect(refs.hasDice).toBe(true);
  });
});

describe("rolagem determinística", () => {
  it("mesma semente e contador dão o mesmo número; faixa de 1 a lados", () => {
    expect(randomAt("abc", 3)).toBe(randomAt("abc", 3));
    expect(randomAt("abc", 3)).not.toBe(randomAt("abc", 4));
    const counts = new Map<number, number>();
    for (let counter = 0; counter < 6000; counter += 1) {
      const value = dieAt("semente", counter, 6);
      expect(value).toBeGreaterThanOrEqual(1);
      expect(value).toBeLessThanOrEqual(6);
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
    // Distribuição razoável: cada face entre 800 e 1200 em 6000 rolagens.
    for (const count of counts.values()) expect(count).toBeGreaterThan(800);
    for (const count of counts.values()) expect(count).toBeLessThan(1200);
  });
});
