import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildStory } from "../../../shared/story-fixture.test-support";

vi.mock("@venore/plugin-sdk/observability", () => ({ beginOperation: vi.fn(() => ({})), endOperation: vi.fn() }));

const findWorkById = vi.fn();
const findStoryRecords = vi.fn();
const updateWorkVariablesRow = vi.fn();
vi.mock("./store", () => ({
  findWorkById: (...args: unknown[]) => findWorkById(...args),
  findStoryRecords: (...args: unknown[]) => findStoryRecords(...args),
  updateWorkVariablesRow: (...args: unknown[]) => updateWorkVariablesRow(...args),
}));

const story = buildStory();
const work = { id: "w1", status: "draft", title: story.work.title, defaultLocale: "pt-BR", locales: ["pt-BR"], variables: story.work.variables };

describe("updateWorkVariables", () => {
  beforeEach(() => {
    [findWorkById, findStoryRecords, updateWorkVariablesRow].forEach((mock) => mock.mockReset());
    updateWorkVariablesRow.mockResolvedValue({ id: "w1" });
    findStoryRecords.mockImplementation(async (next) => ({ work: next, chapters: story.chapters, scenes: story.scenes, choices: story.choices, cast: [] }));
  });

  it("limpa os campos e grava", async () => {
    findWorkById.mockResolvedValue(work);
    const { updateWorkVariables } = await import("./service");
    const result = await updateWorkVariables({
      workId: "w1",
      variables: [{ key: "hp", label: " ", type: "number", initial: 10, display: "hidden" }],
      actorId: "u1",
    });
    expect(result.success).toBe(true);
    expect(updateWorkVariablesRow).toHaveBeenCalledWith("w1", [{ key: "hp", label: "hp", type: "number", initial: 10 }]);
  });

  it("recusa remover variável usada numa obra publicada", async () => {
    findWorkById.mockResolvedValue({ ...work, status: "published" });
    const { updateWorkVariables } = await import("./service");
    const result = await updateWorkVariables({ workId: "w1", variables: [], actorId: "u1" });
    expect(result).toEqual({ success: false, error: expect.objectContaining({ code: "novels.would_break_published" }) });
    expect(updateWorkVariablesRow).not.toHaveBeenCalled();
  });
});
