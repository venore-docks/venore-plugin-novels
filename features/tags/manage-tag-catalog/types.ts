import type { OperationResult } from "@venore/plugin-sdk";
import type { CatalogBadges, LocalizedText, TagCategory, TagSelection } from "../../../contracts/types";

export type SaveTagGroupInput = {
  id?: string | null;
  key: string;
  name: LocalizedText;
  category: TagCategory;
  selection: TagSelection;
  required: boolean;
  allowCustom: boolean;
  showOnCard: boolean;
};
export type SaveTagInput = {
  id?: string | null;
  groupId: string;
  slug: string;
  name: LocalizedText;
  description: LocalizedText;
};
export type ArchiveInput = { id: string; archived: boolean };
export type DeleteInput = { id: string };
export type ReorderInput = { orderedIds: string[]; groupId?: string };
export type UpdateBadgesInput = { badges: CatalogBadges };

export type WithActor<T> = T & { actorId: string };

export type SaveResult = OperationResult<{ id: string }>;
export type VoidResult = OperationResult<null>;
export type InstallStarterPackResult = OperationResult<{ groups: number; tags: number }>;
