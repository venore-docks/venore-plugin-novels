import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildStory } from "../../../shared/story-fixture.test-support";

vi.mock("@venore/plugin-sdk/observability", () => ({ beginOperation: vi.fn(() => ({})), endOperation: vi.fn() }));
const mocks = { findWorkById: vi.fn(), findStoryRecords: vi.fn(), updateGameSystemRow: vi.fn() };
vi.mock("./store", () => Object.fromEntries(Object.entries(mocks).map(([key, fn]) => [key, (...args: unknown[]) => fn(...args)])));

const story = buildStory();
const work = { id: "w1", status: "draft", title: story.work.title, defaultLocale: "pt-BR", locales: ["pt-BR"], variables: story.work.variables, gameSystem: story.system };

describe("updateGameSystem", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.findStoryRecords.mockImplementation(async (next) => ({ work: next, chapters: story.chapters, scenes: story.scenes, choices: story.choices, cast: [], items: [], creatures: [] }));
  });

  it("normaliza e grava (campo desconhecido some, módulo ausente fica desligado)", async () => {
    mocks.findWorkById.mockResolvedValue(work);
    const { updateGameSystem } = await import("./service");
    const result = await updateGameSystem({ workId: "w1", system: { modules: { dice: true }, hack: 1 }, actorId: "u1" });
    expect(result.success).toBe(true);
    const saved = mocks.updateGameSystemRow.mock.calls[0][1];
    expect(saved.modules.dice).toBe(true);
    expect(saved.modules.combat).toBe(false);
    expect("hack" in saved).toBe(false);
  });

  it("obra publicada não fica com fórmula quebrada", async () => {
    mocks.findWorkById.mockResolvedValue({ ...work, status: "published" });
    const { updateGameSystem } = await import("./service");
    const result = await updateGameSystem({
      workId: "w1",
      system: { modules: { resources: true }, resources: [{ key: "vida", name: { "pt-BR": "Vida" }, max: "10 + nada" }] },
      actorId: "u1",
    });
    expect(result).toEqual({ success: false, error: expect.objectContaining({ code: "novels.would_break_published" }) });
    expect(mocks.updateGameSystemRow).not.toHaveBeenCalled();
  });
});
