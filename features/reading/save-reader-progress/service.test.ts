import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildStory } from "../../../shared/story-fixture.test-support";

const mocks = { findWorkById: vi.fn(), findStoryRecords: vi.fn(), findProgressSeed: vi.fn(), upsertReaderProgress: vi.fn() };
vi.mock("./store", () => Object.fromEntries(Object.entries(mocks).map(([key, fn]) => [key, (...args: unknown[]) => fn(...args)])));

const story = buildStory();
const work = { id: "w1", status: "published", title: story.work.title, defaultLocale: "pt-BR", locales: ["pt-BR"], variables: story.work.variables, gameSystem: story.system, coverMediaId: null, coverFocus: null, slug: "obra", subtitle: {}, synopsis: {} };
const saved = { v: 2 as const, seed: "abc", log: [{ t: "start" as const }, { t: "choose" as const, choiceId: "a-b" }], visitedEndings: [], achievements: [] };

describe("saveReaderProgress", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.findWorkById.mockResolvedValue(work);
    mocks.findStoryRecords.mockResolvedValue({ work, chapters: story.chapters, scenes: story.scenes, choices: story.choices, cast: [], items: [], creatures: [] });
    mocks.upsertReaderProgress.mockResolvedValue(new Date("2026-10-07T00:00:00Z"));
  });

  it("refaz a partida e guarda só o trecho válido", async () => {
    mocks.findProgressSeed.mockResolvedValue("abc");
    const { saveReaderProgress } = await import("./service");
    const result = await saveReaderProgress({ workId: "w1", userId: "u1", progress: { kind: "saved", saved: { ...saved, log: [...saved.log, { t: "choose", choiceId: "nao-existe" }] } } });
    expect(result).toEqual({ success: true, data: { updatedAt: expect.any(Date), truncated: true } });
    expect(mocks.upsertReaderProgress.mock.calls[0][2].log).toEqual(saved.log);
  });

  it("recusa trocar de semente no meio da partida", async () => {
    mocks.findProgressSeed.mockResolvedValue("outra");
    const { saveReaderProgress } = await import("./service");
    const result = await saveReaderProgress({ workId: "w1", userId: "u1", progress: { kind: "saved", saved } });
    expect(result).toEqual({ success: false, error: expect.objectContaining({ code: "novels.seed_mismatch" }) });
    expect(mocks.upsertReaderProgress).not.toHaveBeenCalled();
  });
});
