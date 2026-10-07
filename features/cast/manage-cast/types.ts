import type { OperationResult } from "@venore/plugin-sdk";
import type { AccentColor, LocalizedText } from "../../../contracts/types";

export type SaveCastMemberInput = {
  workId: string;
  id?: string | null;
  name: LocalizedText;
  color: AccentColor;
  portraitMediaId: string | null;
};
export type DeleteCastMemberInput = { workId: string; id: string };
export type ReorderCastInput = { workId: string; orderedIds: string[] };
export type WithActor<T> = T & { actorId: string };

export type SaveCastMemberResult = OperationResult<{ id: string }>;
export type CastVoidResult = OperationResult<null>;
