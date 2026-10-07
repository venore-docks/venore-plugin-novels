import type { OperationResult } from "@venore/plugin-sdk";

// "missing": gera só as faixas que faltam, falharam ou têm texto mudado (as em dia ficam).
// "all": refaz todas (ex: depois de trocar a voz ou o worker melhorar).
export type GenerateWorkSpeechInput = { workId: string; mode: "missing" | "all" };
export type GenerateWorkSpeechCommand = GenerateWorkSpeechInput & { actorId: string };
export type GenerateWorkSpeechResult = OperationResult<{ queued: number; unchanged: number; removed: number }>;

export type DeleteWorkSpeechInput = { workId: string };
export type DeleteWorkSpeechCommand = DeleteWorkSpeechInput & { actorId: string };
export type DeleteWorkSpeechResult = OperationResult<{ removed: number }>;
