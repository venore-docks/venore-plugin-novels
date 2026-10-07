import type { OperationResult } from "@venore/plugin-sdk";

export type SaveItemInput = { workId: string; id?: string | null; item: unknown };
export type DeleteItemInput = { workId: string; id: string };
export type ReorderItemsInput = { workId: string; orderedIds: string[] };
export type WithActor<T> = T & { actorId: string };

export type SaveItemResult = OperationResult<{ id: string }>;
export type ItemVoidResult = OperationResult<null>;
