import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildStory } from "../../../shared/story-fixture.test-support";

vi.mock("@venore/plugin-sdk/observability", () => ({ beginOperation: vi.fn(() => ({})), endOperation: vi.fn() }));

const findWorkById = vi.fn();
const findWorkBySlug = vi.fn();
const findStoryRecords = vi.fn();
const findTagCatalog = vi.fn();
const findWorkTagIds = vi.fn();
const updateWorkRow = vi.fn();
vi.mock("./store", () => ({
  findWorkById: (...args: unknown[]) => findWorkById(...args),
  findWorkBySlug: (...args: unknown[]) => findWorkBySlug(...args),
  findStoryRecords: (...args: unknown[]) => findStoryRecords(...args),
  findTagCatalog: (...args: unknown[]) => findTagCatalog(...args),
  findWorkTagIds: (...args: unknown[]) => findWorkTagIds(...args),
  updateWorkRow: (...args: unknown[]) => updateWorkRow(...args),
}));

const story = buildStory();
const baseWork = { id: "w1", slug: "obra", status: "draft", variables: story.work.variables, subtitle: {}, coverFocus: null };
const input = {
  workId: "w1",
  slug: "obra",
  title: { "pt-BR": " Obra ", en: "" },
  synopsis: {},
  defaultLocale: "pt-BR",
  locales: ["pt-BR"],
  coverMediaId: null,
  actorId: "u1",
};
const group = { id: "g1", key: "class", name: {}, category: "info", selection: "single", required: false, allowCustom: false, showOnCard: true, position: 0, archivedAt: null };
const tag = (id: string, archivedAt: Date | null = null) => ({ id, groupId: "g1", slug: id, name: { "pt-BR": id }, description: {}, position: 0, custom: false, archivedAt });

describe("updateWork", () => {
  beforeEach(() => {
    [findWorkById, findWorkBySlug, findStoryRecords, findTagCatalog, findWorkTagIds, updateWorkRow].forEach((mock) => mock.mockReset());
    findWorkBySlug.mockResolvedValue(null);
    updateWorkRow.mockResolvedValue({ id: "w1" });
    findTagCatalog.mockResolvedValue({ groups: [group], tags: [tag("livre"), tag("velha", new Date())], badges: {} });
    findWorkTagIds.mockResolvedValue([]);
  });

  it("normaliza traduções para os idiomas da obra e mantém as tags quando não vêm", async () => {
    findWorkById.mockResolvedValue(baseWork);
    const { updateWork } = await import("./service");
    expect((await updateWork(input)).success).toBe(true);
    expect(updateWorkRow).toHaveBeenCalledWith("w1", expect.objectContaining({ title: { "pt-BR": "Obra" } }), null);
  });

  it("grupo de uma opção guarda só uma tag e tag arquivada nova não entra", async () => {
    findWorkById.mockResolvedValue(baseWork);
    const { updateWork } = await import("./service");
    await updateWork({ ...input, tags: { tagIds: ["velha", "livre"], newTags: [] } });
    expect(updateWorkRow).toHaveBeenCalledWith("w1", expect.anything(), { input: { tagIds: ["livre"], newTags: [] }, actorId: "u1" });
  });

  it("recusa endereço de outra obra", async () => {
    findWorkById.mockResolvedValue(baseWork);
    findWorkBySlug.mockResolvedValue({ id: "w2" });
    const { updateWork } = await import("./service");
    expect((await updateWork(input)).success).toBe(false);
  });
});
