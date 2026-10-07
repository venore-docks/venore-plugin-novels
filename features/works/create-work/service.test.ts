import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@venore/plugin-sdk/observability", () => ({ beginOperation: vi.fn(() => ({})), endOperation: vi.fn() }));

const findWorkBySlug = vi.fn();
const findTagCatalog = vi.fn();
const insertWorkWithFirstChapter = vi.fn();
vi.mock("./store", () => ({
  findWorkBySlug: (...args: unknown[]) => findWorkBySlug(...args),
  findTagCatalog: (...args: unknown[]) => findTagCatalog(...args),
  insertWorkWithFirstChapter: (...args: unknown[]) => insertWorkWithFirstChapter(...args),
}));

const group = {
  id: "g1",
  key: "genero",
  name: { "pt-BR": "Gênero" },
  category: "info",
  selection: "multiple",
  required: false,
  allowCustom: true,
  showOnCard: true,
  position: 0,
  archivedAt: null,
};
const tag = { id: "t1", groupId: "g1", slug: "terror", name: { "pt-BR": "Terror" }, description: {}, position: 0, custom: false, archivedAt: null };

describe("createWork", () => {
  beforeEach(() => {
    [findWorkBySlug, findTagCatalog, insertWorkWithFirstChapter].forEach((mock) => mock.mockReset());
    findTagCatalog.mockResolvedValue({ groups: [group], tags: [tag], badges: {} });
  });

  it("recusa endereço já usado", async () => {
    findWorkBySlug.mockResolvedValue({ id: "w0" });
    const { createWork } = await import("./service");
    const result = await createWork({ title: "Obra", slug: "obra", defaultLocale: "pt-BR", actorId: "u1" });
    expect(result).toEqual({ success: false, error: expect.objectContaining({ code: "novels.slug_taken" }) });
    expect(insertWorkWithFirstChapter).not.toHaveBeenCalled();
  });

  it("grava título, subtítulo e sinopse no idioma principal, com capítulo, cena inicial e tags normalizadas", async () => {
    findWorkBySlug.mockResolvedValue(null);
    insertWorkWithFirstChapter.mockResolvedValue({ id: "w1", firstChapterId: "c1" });
    const { createWork } = await import("./service");
    const result = await createWork({
      title: " Obra ",
      subtitle: "Livro um",
      synopsis: "",
      slug: "obra",
      defaultLocale: "en",
      locales: ["en", "pt-BR"],
      tags: { tagIds: ["t1", "fantasma"], newTags: [{ groupId: "g1", name: " Tibia " }] },
      actorId: "u1",
    });
    expect(result.success).toBe(true);
    expect(insertWorkWithFirstChapter).toHaveBeenCalledWith(
      expect.objectContaining({
        slug: "obra",
        title: { en: "Obra" },
        subtitle: { en: "Livro um" },
        synopsis: {},
        locales: ["en", "pt-BR"],
        authorUserId: "u1",
        firstChapterTitle: { en: "Capítulo 1" },
        tags: { tagIds: ["t1"], newTags: [{ groupId: "g1", name: "Tibia" }] },
      }),
    );
  });
});
