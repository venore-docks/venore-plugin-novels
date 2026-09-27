import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildStory } from "../../../shared/story-fixture.test-support";

vi.mock("@venore/plugin-sdk/observability", () => ({ beginOperation: vi.fn(() => ({})), endOperation: vi.fn() }));

const findWorkById = vi.fn();
const findWorkBySlug = vi.fn();
const findStoryRecords = vi.fn();
const updateWorkRow = vi.fn();
vi.mock("./store", () => ({
  findWorkById: (...args: unknown[]) => findWorkById(...args),
  findWorkBySlug: (...args: unknown[]) => findWorkBySlug(...args),
  findStoryRecords: (...args: unknown[]) => findStoryRecords(...args),
  updateWorkRow: (...args: unknown[]) => updateWorkRow(...args),
}));

const story = buildStory();
const baseWork = { id: "w1", slug: "obra", status: "draft", variables: story.work.variables };
const input = {
  workId: "w1",
  slug: "obra",
  title: { "pt-BR": " Obra ", en: "" },
  synopsis: {},
  defaultLocale: "pt-BR",
  locales: ["pt-BR"],
  coverMediaId: null,
  variables: [],
  actorId: "u1",
};

describe("updateWork", () => {
  beforeEach(() => {
    [findWorkById, findWorkBySlug, findStoryRecords, updateWorkRow].forEach((mock) => mock.mockReset());
    findWorkBySlug.mockResolvedValue(null);
    updateWorkRow.mockResolvedValue({ id: "w1" });
  });

  it("normaliza traduções para os idiomas da obra", async () => {
    findWorkById.mockResolvedValue(baseWork);
    const { updateWork } = await import("./service");
    expect((await updateWork(input)).success).toBe(true);
    expect(updateWorkRow).toHaveBeenCalledWith("w1", expect.objectContaining({ title: { "pt-BR": "Obra" } }));
  });

  it("recusa endereço de outra obra", async () => {
    findWorkById.mockResolvedValue(baseWork);
    findWorkBySlug.mockResolvedValue({ id: "w2" });
    const { updateWork } = await import("./service");
    expect((await updateWork(input)).success).toBe(false);
  });

  it("recusa remover variável usada numa obra publicada", async () => {
    findWorkById.mockResolvedValue({ ...baseWork, status: "published" });
    findStoryRecords.mockImplementation(async (work) => ({
      work,
      chapters: story.chapters,
      scenes: story.scenes,
      choices: story.choices,
    }));
    const { updateWork } = await import("./service");
    const result = await updateWork({ ...input, title: { "pt-BR": "Obra" } });
    expect(result).toEqual({ success: false, error: expect.objectContaining({ code: "graphic-novels.would_break_published" }) });
    expect(updateWorkRow).not.toHaveBeenCalled();
  });
});
