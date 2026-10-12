import type { WorkPackage } from "../../../contracts/work-package";
import { findExamplePackages } from "./store";
import type { ListWorkExamplesResult, WorkExampleCard } from "./types";

export async function listWorkExamples(): Promise<ListWorkExamplesResult> {
  const examples = await findExamplePackages();
  const cards: WorkExampleCard[] = examples.map(({ key, pkg }) => {
    const value = pkg as WorkPackage;
    const scenes = value.chapters.flatMap((chapter) => chapter.scenes);
    return {
      key,
      kind: value.kind ?? key,
      title: value.work.title,
      synopsis: value.work.synopsis ?? {},
      chapters: value.chapters.length,
      scenes: scenes.length,
      endings: scenes.filter((scene) => scene.isEnding).length,
    };
  });
  return { success: true, data: cards };
}
