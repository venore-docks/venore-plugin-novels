import { beforeEach, describe, expect, it, vi } from "vitest";

const syncSpeechAudio = vi.fn(async () => ({ success: true }));
const findWorkById = vi.fn();
const findStoryRecords = vi.fn();
vi.mock("@venore/plugin-sdk/speech", () => ({ syncSpeechAudio: (input: unknown) => syncSpeechAudio(input) }));
vi.mock("./store", () => ({
  findWorkById: (id: string) => findWorkById(id),
  findStoryRecords: (work: unknown) => findStoryRecords(work),
}));

const { syncWorkSpeech } = await import("./service");
const scenes = [{ id: "s1", body: { "pt-BR": "Olá" } }];

describe("syncWorkSpeech", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findStoryRecords.mockResolvedValue({ scenes });
  });

  it("opção ligada e obra publicada: uma faixa por cena e idioma", async () => {
    findWorkById.mockResolvedValue({
      id: "w1",
      status: "published",
      speechEnabled: true,
      locales: ["pt-BR"],
      defaultLocale: "pt-BR",
      title: { "pt-BR": "O Farol" },
    });
    await syncWorkSpeech("w1");
    expect(syncSpeechAudio).toHaveBeenCalledWith({
      scope: "novels.work:w1",
      items: [{ itemKey: "scene:s1", locale: "pt-BR", text: "Olá" }],
      source: { label: "O Farol", href: "/admin/novels/works/w1" },
    });
  });

  it("opção desligada: apaga o áudio da obra, publicada ou não", async () => {
    findWorkById.mockResolvedValue({ id: "w1", status: "draft", speechEnabled: false, locales: ["pt-BR"], defaultLocale: "pt-BR", title: { "pt-BR": "O Farol" } });
    await syncWorkSpeech("w1");
    expect(syncSpeechAudio).toHaveBeenCalledWith(expect.objectContaining({ scope: "novels.work:w1", items: [] }));
  });

  it("opção ligada em rascunho: não mexe (republicar não gera de novo)", async () => {
    findWorkById.mockResolvedValue({ id: "w1", status: "draft", speechEnabled: true, locales: ["pt-BR"] });
    await syncWorkSpeech("w1");
    expect(syncSpeechAudio).not.toHaveBeenCalled();
  });

  it("obra apagada: apaga o áudio", async () => {
    findWorkById.mockResolvedValue(null);
    await syncWorkSpeech("w1");
    expect(syncSpeechAudio).toHaveBeenCalledWith({ scope: "novels.work:w1", items: [] });
  });
});
