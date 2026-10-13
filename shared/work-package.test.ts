import { describe, expect, it } from "vitest";
import { WORK_PACKAGE_FORMAT, type WorkPackage } from "../contracts/work-package";
import { packageFromRecords, planWorkImport, recordsFromImported } from "./work-package";

const t = (text: string) => ({ "pt-BR": text });

function sample(): WorkPackage {
  return {
    format: WORK_PACKAGE_FORMAT,
    version: 1,
    kind: "aventura_simples",
    work: { slug: "Ponte Velha", title: t("A Ponte Velha"), synopsis: t("Atravessar ou não.") },
    system: {
      modules: { resources: true, dice: true, inventory: true } as never,
      resources: [{ key: "vida", name: t("Vida"), abbr: t("V"), color: "chart-5", max: "10", initial: "max", regen: "", regenInCombat: false, onZero: { sceneId: "queda", effects: [] }, onFull: null, showInHud: true, lowPercent: 25 }],
    },
    cast: [{ key: "guia", name: t("Guia"), color: "chart-2" }],
    items: [{ key: "corda", name: t("Corda"), description: {}, type: "material", slot: null, hands: 0, size: 1, weight: 1, stackable: false, maxStack: 1, modifiers: [], useEffects: [], consumable: false, requirements: [], containerSlots: 0, value: 0, rarity: "common", droppable: true }],
    creatures: [],
    chapters: [
      {
        key: "cap1",
        title: t("A ponte"),
        start: "beira",
        scenes: [
          { key: "beira", label: "Beira", text: t("O vento empurra a ponte."), blocks: [{ type: "speech", castId: "guia", text: t("Segure firme.") }, { type: "image", mediaId: "foto-de-outra-instalacao", alt: {}, aspect: "auto", bleed: true }] },
          { key: "meio", label: "Meio", text: t("A madeira estala."), mechanics: { kind: "text", onZero: { vida: "queda" }, noRegen: false, encounter: null, shop: null } },
          { key: "queda", label: "Queda", text: t("Você cai."), isEnding: true, endingTitle: t("Queda") },
        ],
        choices: [
          {
            from: "beira",
            to: "meio",
            label: t("Atravessar"),
            mechanics: { cost: [], whenUnavailable: "hide", test: { roll: "1d20", dc: "8", label: t("Equilíbrio"), successEffects: [], failure: { targetSceneId: "queda", effects: [] }, critical: null, fumble: null, bands: [] } },
          },
          { from: "beira", to: "meio", label: t("Amarrar a corda"), conditions: [{ kind: "item", itemId: "corda", min: 1 }] },
        ],
      },
      {
        key: "cap2",
        title: t("O outro lado"),
        start: "chegada",
        scenes: [{ key: "chegada", label: "Chegada", text: t("Terra firme."), isEnding: true, endingTitle: t("Do outro lado") }],
        choices: [],
      },
    ],
  };
}

const ids = () => {
  let counter = 0;
  return () => `id-${(counter += 1)}`;
};

describe("pacote de obra", () => {
  it("importa com ids novos, troca as chaves e zera mídia", () => {
    const plan = planWorkImport(JSON.stringify(sample()), ids());
    if (!plan.ok) throw new Error(plan.errors.join("; "));
    const { work, chapters, items, cast } = plan.value;
    expect(work.slug).toBe("ponte-velha");
    const [first] = chapters;
    const byLabel = new Map(first.graph.scenes.map((scene) => [scene.label, scene]));
    expect(work.gameSystem.resources[0].onZero?.sceneId).toBe(byLabel.get("Queda")!.id);
    expect(first.graph.choices[0].mechanics.test?.failure.targetSceneId).toBe(byLabel.get("Queda")!.id);
    expect(byLabel.get("Meio")!.mechanics.onZero).toEqual({ vida: byLabel.get("Queda")!.id });
    expect(first.graph.choices[1].conditions).toEqual([{ kind: "item", itemId: items[0].id, min: 1 }]);
    const blocks = byLabel.get("Beira")!.blocks;
    expect(blocks.map((block) => block.type)).toEqual(["text", "speech", "image"]);
    expect(blocks[1]).toMatchObject({ castId: cast[0].id });
    expect(blocks[2]).toMatchObject({ mediaId: null });
    // Sem x/y: camadas a partir da cena inicial.
    expect(byLabel.get("Beira")!.graphY).toBe(0);
    expect(byLabel.get("Meio")!.graphY).toBe(240);
    expect(plan.issues.filter((issue) => issue.severity === "error").map((issue) => issue.message)).toEqual([]);
  });

  it("exporta e importa de novo sem perder a história", () => {
    const first = planWorkImport(sample(), ids());
    if (!first.ok) throw new Error("import");
    const exported = packageFromRecords(recordsFromImported(first.value), { tags: [] });
    expect(exported.chapters[0].scenes.map((scene) => scene.key)).toEqual(["beira", "meio", "queda"]);
    expect(exported.cast?.[0].key).toBe("guia");
    expect(exported.system?.resources?.[0].onZero?.sceneId).toBe("queda");
    expect(exported.chapters[0].scenes[1].mechanics?.onZero).toEqual({ vida: "queda" });
    const again = planWorkImport(JSON.parse(JSON.stringify(exported)), ids());
    if (!again.ok) throw new Error(again.errors.join("; "));
    expect(again.value.chapters.flatMap((chapter) => chapter.graph.choices).length).toBe(2);
    expect(again.issues.filter((issue) => issue.severity === "error")).toEqual([]);
  });

  it("aponta referência quebrada e escolha entre capítulos", () => {
    const broken = sample();
    broken.chapters[0].choices.push({ from: "meio", to: "chegada", label: t("Pular") });
    broken.chapters[0].choices[1].conditions = [{ kind: "item", itemId: "lanterna", min: 1 }];
    const plan = planWorkImport(broken, ids());
    expect(plan.ok).toBe(false);
    if (plan.ok) return;
    expect(plan.errors.some((error) => error.includes('item "lanterna" não existe'))).toBe(true);
    expect(plan.errors.some((error) => error.includes('cena "chegada" não é deste capítulo'))).toBe(true);
  });

  it("recusa arquivo que não é pacote de obra", () => {
    expect(planWorkImport("{}", ids())).toEqual({ ok: false, errors: [expect.stringContaining("venore-novels-work")] });
    expect(planWorkImport("não é json", ids())).toEqual({ ok: false, errors: ["O arquivo não é um JSON válido."] });
  });
});
