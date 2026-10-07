import type { OperationResult } from "@venore/plugin-sdk";
import type { GameSystem } from "../../../contracts/game";

export type UpdateGameSystemInput = { workId: string; system: unknown };
export type UpdateGameSystemCommand = UpdateGameSystemInput & { actorId: string };
export type UpdateGameSystemResult = OperationResult<{ system: GameSystem }>;
