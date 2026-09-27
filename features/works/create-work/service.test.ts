import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@venore/plugin-sdk/observability", () => ({ beginOperation: vi.fn(() => ({})), endOperation: vi.fn() }));

const findWorkBySlug = vi.fn();
const insertWorkWithFirstChapter = vi.fn();
vi.mock("./store", () => ({
  findWorkBySlug: (...args: unknown[]) => findWorkBySlug(...args),
  insertWorkWithFirstChapter: (...args: unknown[]) => insertWorkWithFirstChapter(...args),
}));

describe("createWork", () => {
  beforeEach(() => {
    findWorkBySlug.mockReset();
    insertWorkWithFirstChapter.mockReset();
  });

  it("recusa endereço já usado", async () => {
    findWorkBySlug.mockResolvedValue({ id: "w0" });
    const { createWork } = await import("./service");
    const result = await createWork({ title: "Obra", slug: "obra", defaultLocale: "pt-BR", actorId: "u1" });
    expect(result).toEqual({ success: false, error: expect.objectContaining({ code: "graphic-novels.slug_taken" }) });
    expect(insertWorkWithFirstChapter).not.toHaveBeenCalled();
  });

  it("grava o título no idioma principal e cria o primeiro capítulo", async () => {
    findWorkBySlug.mockResolvedValue(null);
    insertWorkWithFirstChapter.mockResolvedValue({ id: "w1" });
    const { createWork } = await import("./service");
    const result = await createWork({ title: "Obra", slug: "obra", defaultLocale: "en", actorId: "u1" });
    expect(result.success).toBe(true);
    expect(insertWorkWithFirstChapter).toHaveBeenCalledWith({
      slug: "obra",
      title: { en: "Obra" },
      defaultLocale: "en",
      authorUserId: "u1",
      firstChapterTitle: { en: "Capítulo 1" },
    });
  });
});
