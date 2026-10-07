import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@venore/plugin-sdk/observability", () => ({ beginOperation: vi.fn(() => ({})), endOperation: vi.fn() }));
const syncSpeechAudio = vi.fn();
const getSpeechState = vi.fn();
vi.mock("@venore/plugin-sdk/speech", () => ({
  syncSpeechAudio: (input: unknown) => syncSpeechAudio(input),
  getSpeechState: (input: unknown) => getSpeechState(input),
}));
const findWorkById = vi.fn();
const findStoryRecords = vi.fn();
const setWorkSpeechEnabled = vi.fn();
vi.mock("./store", () => ({
  findWorkById: (id: string) => findWorkById(id),
  findStoryRecords: (work: unknown) => findStoryRecords(work),
  setWorkSpeechEnabled: (id: string, enabled: boolean) => setWorkSpeechEnabled(id, enabled),
}));

const { generateWorkSpeech, deleteWorkSpeech, removeWorkSpeech } = await import("./service");
const work = { id: "w1", status: "draft", locales: ["pt-BR"], defaultLocale: "pt-BR", title: { "pt-BR": "O Farol" } };
const items = [{ itemKey: "scene:s1", locale: "pt-BR", text: "Olá" }];

describe("áudio da obra por ação explícita", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findWorkById.mockResolvedValue(work);
    findStoryRecords.mockResolvedValue({ scenes: [{ id: "s1", blocks: [{ id: "b", type: "text", text: { "pt-BR": "Olá" } }] }], cast: [] });
    getSpeechState.mockResolvedValue({ success: true, data: { active: true } });
    syncSpeechAudio.mockResolvedValue({ success: true, data: { queued: 1, unchanged: 0, removed: 0 } });
  });

  it("gerar o que falta: manda as faixas com título e link, sem refazer as em dia", async () => {
    const result = await generateWorkSpeech({ workId: "w1", mode: "missing", actorId: "u1" });
    expect(result.success).toBe(true);
    expect(syncSpeechAudio).toHaveBeenCalledWith({
      scope: "novels.work:w1",
      items,
      regenerate: false,
      source: { label: "O Farol", href: "/admin/novels/works/w1?tab=audio" },
    });
    expect(setWorkSpeechEnabled).toHaveBeenCalledWith("w1", true);
  });

  it("gerar tudo de novo usa regenerate (vale também para rascunho)", async () => {
    await generateWorkSpeech({ workId: "w1", mode: "all", actorId: "u1" });
    expect(syncSpeechAudio).toHaveBeenCalledWith(expect.objectContaining({ regenerate: true }));
  });

  it("leitura desligada ou obra sem texto: recusa sem mexer no áudio", async () => {
    getSpeechState.mockResolvedValue({ success: true, data: { active: false } });
    expect(await generateWorkSpeech({ workId: "w1", mode: "missing", actorId: "u1" })).toEqual({
      success: false,
      error: expect.objectContaining({ code: "novels.speech_disabled" }),
    });
    findStoryRecords.mockResolvedValue({ scenes: [] });
    expect((await generateWorkSpeech({ workId: "w1", mode: "missing", actorId: "u1" })).success).toBe(false);
    expect(syncSpeechAudio).not.toHaveBeenCalled();
  });

  it("apagar remove todas as faixas e desliga a obra", async () => {
    syncSpeechAudio.mockResolvedValue({ success: true, data: { queued: 0, unchanged: 0, removed: 3 } });
    expect(await deleteWorkSpeech({ workId: "w1", actorId: "u1" })).toEqual({ success: true, data: { removed: 3 } });
    expect(syncSpeechAudio).toHaveBeenCalledWith({ scope: "novels.work:w1", items: [] });
    expect(setWorkSpeechEnabled).toHaveBeenCalledWith("w1", false);
  });

  it("obra apagada leva o áudio junto, sem derrubar a exclusão se falhar", async () => {
    syncSpeechAudio.mockRejectedValueOnce(new Error("fora do ar"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(removeWorkSpeech("w1")).resolves.toBeUndefined();
    warn.mockRestore();
  });
});
