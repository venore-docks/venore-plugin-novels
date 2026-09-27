import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildStory } from "../../../shared/story-fixture.test-support";

vi.mock("@venore/plugin-sdk/observability", () => ({ beginOperation: vi.fn(() => ({})), endOperation: vi.fn() }));

const findWorkById = vi.fn();
const findStoryRecords = vi.fn();
const setWorkStatus = vi.fn();
vi.mock("./store", () => ({
  findWorkById: (...args: unknown[]) => findWorkById(...args),
  findStoryRecords: (...args: unknown[]) => findStoryRecords(...args),
  setWorkStatus: (...args: unknown[]) => setWorkStatus(...args),
}));

const story = buildStory();
const work = { id: "w1", status: "draft", publishedAt: null, ...story.work };

describe("publishWork", () => {
  beforeEach(() => {
    [findWorkById, findStoryRecords, setWorkStatus].forEach((mock) => mock.mockReset());
    findWorkById.mockResolvedValue(work);
    setWorkStatus.mockResolvedValue({ ...work, status: "published" });
  });

  it("publica obra sem erro", async () => {
    findStoryRecords.mockResolvedValue({ work, chapters: story.chapters, scenes: story.scenes, choices: story.choices });
    const { publishWork } = await import("./service");
    expect((await publishWork({ workId: "w1", actorId: "u1" })).success).toBe(true);
    expect(setWorkStatus).toHaveBeenCalledWith("w1", "published", expect.any(Date));
  });

  it("recusa obra com erro e não muda o status", async () => {
    findStoryRecords.mockResolvedValue({ work, chapters: [], scenes: [], choices: [] });
    const { publishWork } = await import("./service");
    const result = await publishWork({ workId: "w1", actorId: "u1" });
    expect(result).toEqual({ success: false, error: expect.objectContaining({ code: "graphic-novels.not_publishable" }) });
    expect(setWorkStatus).not.toHaveBeenCalled();
  });
});
