import type { OperationResult } from "@venore/plugin-sdk";
import type { PlayAction, SavedGame } from "../../../shared/engine/types";

export type StartReaderGameInput = { workId: string; start: unknown };
export type StartReaderGameCommand = { workId: string; start: Extract<PlayAction, { t: "start" }>; userId: string };
export type StartReaderGameResult = OperationResult<SavedGame>;
