import { beforeEach, describe, expect, it, vi } from "vitest";
import { toChapterGraphScene } from "../../../shared/build-story";
import { buildStory } from "../../../shared/story-fixture.test-support";

vi.mock("@venore/plugin-sdk/observability", () => ({ beginOperation: vi.fn(() => ({})), endOperation: vi.fn() }));

const findChapterWithWork = vi.fn();
const findForeignSceneIds = vi.fn();
const findForeignChoiceIds = vi.fn();
const findStoryRecords = vi.fn();
const replaceChapterGraph = vi.fn();
vi.mock("./store", () => ({
  findChapterWithWork: (...args: unknown[]) => findChapterWithWork(...args),
  findForeignSceneIds: (...args: unknown[]) => findForeignSceneIds(...args),
  findForeignChoiceIds: (...args: unknown[]) => findForeignChoiceIds(...args),
  findStoryRecords: (...args: unknown[]) => findStoryRecords(...args),
  replaceChapterGraph: (...args: unknown[]) => replaceChapterGraph(...args),
}));

const story = buildStory();
const work = { id: "w1", status: "draft", defaultLocale: "pt-BR", locales: ["pt-BR"], title: story.work.title, variables: story.work.variables };
const records = {
  work,
  chapters: story.chapters,
  scenes: story.scenes.map((scene) => ({ ...toChapterGraphScene({ ...scene, workId: "w1" }), workId: "w1", chapterId: scene.chapterId })),
  choices: story.choices,
  cast: [],
};
const chapter1 = story.chapters.find((chapter) => chapter.id === "ch1")!;

function ch1Graph() {
  const scenes = story.scenes
    .filter((scene) => scene.chapterId === "ch1")
    .map((scene) => toChapterGraphScene({ ...scene, workId: "w1" }));
  return { startSceneId: "a", scenes, choices: story.choices };
}

describe("saveChapterGraph", () => {
  beforeEach(() => {
    [findChapterWithWork, findForeignSceneIds, findForeignChoiceIds, findStoryRecords, replaceChapterGraph].forEach((mock) =>
      mock.mockReset(),
    );
    findForeignSceneIds.mockResolvedValue([]);
    findForeignChoiceIds.mockResolvedValue([]);
    findStoryRecords.mockResolvedValue(records);
    replaceChapterGraph.mockResolvedValue(new Date("2026-09-27T00:00:00Z"));
  });

  it("salva e devolve os problemas da obra", async () => {
    findChapterWithWork.mockResolvedValue({ chapter: chapter1, work });
    const { saveChapterGraph } = await import("./service");
    const result = await saveChapterGraph({ workId: "w1", chapterId: "ch1", graph: ch1Graph(), actorId: "u1" });
    expect(result.success).toBe(true);
    expect(replaceChapterGraph).toHaveBeenCalledWith("w1", "ch1", expect.objectContaining({ startSceneId: "a" }));
  });

  it("recusa ids de cena de outro capítulo", async () => {
    findChapterWithWork.mockResolvedValue({ chapter: chapter1, work });
    findForeignSceneIds.mockResolvedValue(["d"]);
    const { saveChapterGraph } = await import("./service");
    const result = await saveChapterGraph({ workId: "w1", chapterId: "ch1", graph: ch1Graph(), actorId: "u1" });
    expect(result.success).toBe(false);
    expect(replaceChapterGraph).not.toHaveBeenCalled();
  });

  it("recusa capítulo de outra obra", async () => {
    findChapterWithWork.mockResolvedValue({ chapter: chapter1, work: { ...work, id: "w2" } });
    const { saveChapterGraph } = await import("./service");
    expect((await saveChapterGraph({ workId: "w1", chapterId: "ch1", graph: ch1Graph(), actorId: "u1" })).success).toBe(false);
  });

  it("em obra publicada, recusa salvar grafo que quebra a leitura", async () => {
    findChapterWithWork.mockResolvedValue({ chapter: chapter1, work: { ...work, status: "published" } });
    const { saveChapterGraph } = await import("./service");
    const broken = { ...ch1Graph(), startSceneId: null };
    const result = await saveChapterGraph({ workId: "w1", chapterId: "ch1", graph: broken, actorId: "u1" });
    expect(result).toEqual({ success: false, error: expect.objectContaining({ code: "novels.would_break_published" }) });
  });
});
