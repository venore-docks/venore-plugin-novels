import type { OperationResult } from "@venore/plugin-sdk";
import type { LocalizedText } from "../../../contracts/types";

export type GetWorkStatsInput = { workId: string };

export type SceneCount = { sceneId: string; label: string; chapterTitle: LocalizedText; count: number };
export type ChoiceCount = { choiceId: string; label: LocalizedText; sceneLabel: string; count: number; share: number };

// Estatísticas agregadas de quem lê com conta (o progresso anônimo fica só no navegador).
export type WorkStatsView = {
  readers: number;
  sampled: number;
  finished: number;
  endings: SceneCount[];
  stops: SceneCount[];
  deaths: SceneCount[];
  choices: ChoiceCount[];
};
export type GetWorkStatsResult = OperationResult<WorkStatsView>;
