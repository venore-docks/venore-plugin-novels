import { describe, expect, it } from "vitest";
import { EMPTY_READER_STATS, exploredPercent, extendsLog, mergeStats, readerAchievements } from "./reader-stats";

const totals = { sceneIds: ["a", "b", "c", "d"], choiceIds: ["x", "y"], endingIds: ["c", "d"] };
const journey = (seed: string, scenes: string[], finished: boolean) => ({ seed, scenes, choices: ["x"], endings: finished ? [scenes.at(-1)!] : [], achievements: [], finished });

describe("reader stats", () => {
  it("conta uma conclusão por jornada e soma o que foi visto", () => {
    let stats = mergeStats(EMPTY_READER_STATS, journey("s1", ["a", "c"], true));
    stats = mergeStats(stats, journey("s1", ["a", "c"], true));
    stats = mergeStats(stats, journey("s2", ["a", "b", "d"], true));
    expect(stats.completions).toBe(2);
    expect(exploredPercent(stats, totals)).toBe(83);
    const unlocked = readerAchievements(stats, totals).filter((achievement) => achievement.unlocked).map((achievement) => achievement.id);
    expect(unlocked).toEqual(["primeira_jornada", "explorador", "todos_finais"]);
  });

  it("só aceita registro que continua o salvo, sem depender da ordem das chaves", () => {
    const stored = [{ t: "start", hardcore: false, profile: {} }, { t: "choose", choiceId: "x" }];
    expect(extendsLog(stored, [{ profile: {}, t: "start", hardcore: false, vocationId: undefined }, { choiceId: "x", t: "choose" }, { t: "continue" }])).toBe(true);
    expect(extendsLog(stored, [stored[0], { t: "choose", choiceId: "y" }])).toBe(false);
    expect(extendsLog(stored, [stored[0]])).toBe(false);
  });
});
