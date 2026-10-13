import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildStory } from "../../../shared/story-fixture.test-support";

vi.mock("@venore/plugin-sdk/observability", () => ({ beginOperation: vi.fn(() => ({})), endOperation: vi.fn() }));
const mocks = { findWorkById: vi.fn(), findStoryRecords: vi.fn(), findTemplates: vi.fn(), findTemplateByKey: vi.fn(), upsertTemplate: vi.fn(), deleteTemplate: vi.fn(), applyPlan: vi.fn() };
vi.mock("./store", () => Object.fromEntries(Object.entries(mocks).map(([key, fn]) => [key, (...args: unknown[]) => fn(...args)])));

const story = buildStory();
const work = { id: "w1", status: "draft", title: story.work.title, defaultLocale: "pt-BR", locales: ["pt-BR"], variables: story.work.variables, gameSystem: story.system };

describe("modelos de sistema (service)", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.findWorkById.mockResolvedValue(work);
    mocks.findStoryRecords.mockResolvedValue({ work, chapters: story.chapters, scenes: story.scenes, choices: story.choices, cast: [], items: [], creatures: [] });
    mocks.findTemplates.mockResolvedValue([]);
  });

  it("lista os modelos do plugin antes dos importados", async () => {
    const { listSystemTemplates } = await import("./service");
    const result = await listSystemTemplates();
    expect(result.success && result.data.map((template) => template.key)).toEqual(["aventura_simples", "rpg_fantasia", "tibia_like", "terror_sanidade"]);
  });

  it("aplicar um modelo do plugin grava sistema, itens e criaturas", async () => {
    const { applySystemTemplate } = await import("./service");
    const result = await applySystemTemplate({ workId: "w1", templateKey: "rpg_fantasia", actorId: "u1" });
    expect(result).toEqual({ success: true, data: { items: 6, creatures: 2 } });
    const plan = mocks.applyPlan.mock.calls[0][1];
    expect(plan.system.modules.combat).toBe(true);
    expect(plan.variables.map((variable: { key: string }) => variable.key)).toEqual(["coragem", "chave"]);
  });

  it("importar recusa a chave de um modelo do plugin", async () => {
    const { importSystemTemplate } = await import("./service");
    const { BUILT_IN_TEMPLATES } = await import("../../../shared/templates/built-in");
    const result = await importSystemTemplate({ package: JSON.stringify(BUILT_IN_TEMPLATES[0]), actorId: "u1" });
    expect(result).toEqual({ success: false, error: expect.objectContaining({ code: "novels.template_key_reserved" }) });
    const ok = await importSystemTemplate({ package: JSON.stringify({ ...BUILT_IN_TEMPLATES[0], key: "meu_modelo" }), actorId: "u1" });
    expect(ok.success).toBe(true);
    expect(mocks.upsertTemplate).toHaveBeenCalledTimes(1);
  });
});
