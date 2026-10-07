import type { OperationResult } from "@venore/plugin-sdk";

export type SaveCreatureInput = { workId: string; id?: string | null; creature: unknown };
export type DeleteCreatureInput = { workId: string; id: string };
export type ReorderCreaturesInput = { workId: string; orderedIds: string[] };
export type WithActor<T> = T & { actorId: string };

export type SaveCreatureResult = OperationResult<{ id: string }>;
export type CreatureVoidResult = OperationResult<null>;
