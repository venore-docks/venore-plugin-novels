import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildStory } from "../../../shared/story-fixture.test-support";

const mocks = { findWorkById: vi.fn(), findStoryRecords: vi.fn(), findStoredProgress: vi.fn(), saveProgressAndStats: vi.fn() };
vi.mock("./store", () => Object.fromEntries(Object.entries(mocks).map(([key, fn]) => [key, (...args: unknown[]) => fn(...args)])));

const story = buildStory();
const work = { id: "w1", status: "published", title: story.work.title, defaultLocale: "pt-BR", locales: ["pt-BR"], variables: story.work.variables, gameSystem: story.system, coverMediaId: null, coverFocus: null, slug: "obra", subtitle: {}, synopsis: {} };
const saved = { v: 2 as const, seed: "abc", log: [{ t: "start" as const }, { t: "choose" as const, choiceId: "a-b" }], visitedEndings: [], achievements: [] };

describe("saveReaderProgress", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.findWorkById.mockResolvedValue(work);
    mocks.findStoryRecords.mockResolvedValue({ work, chapters: story.chapters, scenes: story.scenes, choices: story.choices, cast: [], items: [], creatures: [] });
    mocks.saveProgressAndStats.mockResolvedValue(new Date("2026-10-07T00:00:00Z"));
  });

  it("refaz a partida, guarda só o trecho válido e soma o desempenho", async () => {
    mocks.findStoredProgress.mockResolvedValue({ ...saved, log: [{ t: "start" }] });
    const { saveReaderProgress } = await import("./service");
    const result = await saveReaderProgress({ workId: "w1", userId: "u1", progress: { kind: "saved", saved: { ...saved, log: [...saved.log, { t: "choose", choiceId: "nao-existe" }] } } });
    expect(result).toEqual({ success: true, data: { updatedAt: expect.any(Date), truncated: true } });
    expect(mocks.saveProgressAndStats.mock.calls[0][2].log).toEqual(saved.log);
    const merge = mocks.saveProgressAndStats.mock.calls[0][3];
    expect(merge({ completions: 0, lastCompletedSeed: null, scenesSeen: [], choicesSeen: [], endingsSeen: [], achievements: [] }).choicesSeen).toEqual(["a-b"]);
  });

  it("recusa trocar de semente no meio da partida", async () => {
    mocks.findStoredProgress.mockResolvedValue({ ...saved, seed: "outra" });
    const { saveReaderProgress } = await import("./service");
    const result = await saveReaderProgress({ workId: "w1", userId: "u1", progress: { kind: "saved", saved } });
    expect(result).toEqual({ success: false, error: expect.objectContaining({ code: "novels.seed_mismatch" }) });
    expect(mocks.saveProgressAndStats).not.toHaveBeenCalled();
  });

  it("não deixa voltar na história para escolher outra opção", async () => {
    mocks.findStoredProgress.mockResolvedValue(saved);
    const { saveReaderProgress } = await import("./service");
    const result = await saveReaderProgress({ workId: "w1", userId: "u1", progress: { kind: "saved", saved: { ...saved, log: [{ t: "start" }, { t: "choose", choiceId: "outra" }] } } });
    expect(result).toEqual({ success: false, error: expect.objectContaining({ code: "novels.no_going_back" }) });
  });
});
