import { describe, expect, it } from "vitest";
import { validateGameSystem } from "../engine/validate";
import { BUILT_IN_TEMPLATES } from "./built-in";
import { packageFromWork, parsePackage, planApply } from "./package";

describe("modelos de sistema", () => {
  it("os modelos do plugin passam pelo leitor de pacotes e não têm erro de regra", () => {
    for (const template of BUILT_IN_TEMPLATES) {
      const parsed = parsePackage(JSON.stringify(template));
      expect(parsed.ok, template.key).toBe(true);
      if (!parsed.ok) continue;
      const issues = validateGameSystem({ system: parsed.value.system, variables: parsed.value.variables, items: parsed.value.items, creatures: parsed.value.creatures, sceneIds: new Set() });
      expect(issues.filter((issue) => issue.severity === "error").map((issue) => issue.message), template.key).toEqual([]);
    }
  });

  it("recusa arquivo que não é modelo, versão desconhecida e item repetido", () => {
    expect(parsePackage("{oops").ok).toBe(false);
    expect(parsePackage({ format: "outra-coisa" }).ok).toBe(false);
    const base = BUILT_IN_TEMPLATES[1];
    expect(parsePackage({ ...base, version: 2 }).ok).toBe(false);
    expect(parsePackage({ ...base, items: [base.items[0], base.items[0]] }).ok).toBe(false);
  });

  it("aplicar casa itens pela chave, cria ids novos e troca as referências", () => {
    const fantasy = BUILT_IN_TEMPLATES.find((template) => template.key === "rpg_fantasia")!;
    let counter = 0;
    const plan = planApply(fantasy, { variables: [{ key: "coragem", label: "Coragem", type: "number", initial: 0 }], items: [{ id: "existente", key: "adaga" }], creatures: [] }, () => `novo-${(counter += 1)}`);
    const adaga = plan.items.find((entry) => entry.fields.key === "adaga")!;
    expect(adaga).toMatchObject({ id: "existente", isNew: false });
    const espada = plan.items.find((entry) => entry.fields.key === "espada_curta")!;
    expect(espada.isNew).toBe(true);
    const guerreiro = plan.system.character.vocations.find((vocation) => vocation.id === "guerreiro")!;
    expect(guerreiro.items[0].itemId).toBe(espada.id);
    const goblin = plan.creatures.find((entry) => entry.fields.key === "goblin")!;
    expect(goblin.fields.loot[0].itemId).toBe("existente");
    expect(plan.variables.map((variable) => variable.key)).toEqual(["coragem"]);
  });

  it("exportar troca ids por chaves e apaga referências de cena", () => {
    const system = structuredClone(BUILT_IN_TEMPLATES[0].system);
    system.resources[0].onZero = { sceneId: "cena-x", effects: [{ kind: "item", operation: "take", itemId: "id-1", quantity: "1" }] };
    const pkg = packageFromWork(
      { system, variables: [], items: [{ ...BUILT_IN_TEMPLATES[1].items[0], id: "id-1", key: "faca" }], creatures: [] },
      { key: "meu", name: { "pt-BR": "Meu" }, description: {} },
    );
    expect(pkg.items[0].id).toBe("faca");
    expect(pkg.system.resources[0].onZero).toEqual({ sceneId: null, effects: [{ kind: "item", operation: "take", itemId: "faca", quantity: "1" }] });
    expect(parsePackage(JSON.parse(JSON.stringify(pkg))).ok).toBe(true);
  });
});
