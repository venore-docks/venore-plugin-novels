import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@venore/plugin-sdk/observability", () => ({ beginOperation: vi.fn(() => ({})), endOperation: vi.fn() }));

const mocks = {
  findWorkById: vi.fn(),
  countCast: vi.fn(),
  insertCastMember: vi.fn(),
  updateCastMember: vi.fn(),
  countScenesWithSpeaker: vi.fn(),
  deleteCastMember: vi.fn(),
  reorderCast: vi.fn(),
};
vi.mock("./store", () => Object.fromEntries(Object.entries(mocks).map(([key, fn]) => [key, (...args: unknown[]) => fn(...args)])));

describe("elenco", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.findWorkById.mockResolvedValue({ id: "w1", defaultLocale: "pt-BR", locales: ["pt-BR"] });
    mocks.countCast.mockResolvedValue(0);
    mocks.insertCastMember.mockResolvedValue("c1");
  });

  it("cria personagem com nome no idioma principal", async () => {
    const { saveCastMember } = await import("./service");
    const result = await saveCastMember({ workId: "w1", name: { "pt-BR": " Faroleiro ", en: "x" }, color: "chart-6", portraitMediaId: null, actorId: "u1" });
    expect(result).toEqual({ success: true, data: { id: "c1" } });
    expect(mocks.insertCastMember).toHaveBeenCalledWith("w1", { name: { "pt-BR": "Faroleiro" }, color: "chart-6", portraitMediaId: null });
  });

  it("não remove quem ainda fala em alguma cena", async () => {
    mocks.countScenesWithSpeaker.mockResolvedValue(2);
    const { deleteCastMember } = await import("./service");
    const result = await deleteCastMember({ workId: "w1", id: "c1", actorId: "u1" });
    expect(result).toEqual({ success: false, error: expect.objectContaining({ code: "novels.cast_in_use" }) });
    expect(mocks.deleteCastMember).not.toHaveBeenCalled();
  });
});
