// Barrel público do plugin: o que páginas, actions, blocos e (no futuro) outros plugins podem
// importar. Nomes sem o sufixo Handler, mesmo padrão do birthdays/academy.
export { novelsBreadcrumbSegments } from "./breadcrumbs";
export { getCachedChapterGraph, getCachedPublishedStory, getCachedWork } from "./shared/cached-queries";
export { createWorkHandler as createWork } from "./features/works/create-work/handler";
export { getNewWorkFormHandler as getNewWorkForm } from "./features/works/get-new-work-form/handler";
export { updateWorkHandler as updateWork } from "./features/works/update-work/handler";
export { updateWorkVariablesHandler as updateWorkVariables } from "./features/works/update-work-variables/handler";
export { deleteWorkHandler as deleteWork } from "./features/works/delete-work/handler";
export { listWorksHandler as listWorks } from "./features/works/list-works/handler";
export { getWorkHandler as getWork } from "./features/works/get-work/handler";
export { createChapterHandler as createChapter } from "./features/chapters/create-chapter/handler";
export { updateChapterHandler as updateChapter } from "./features/chapters/update-chapter/handler";
export { deleteChapterHandler as deleteChapter } from "./features/chapters/delete-chapter/handler";
export { moveChapterHandler as moveChapter } from "./features/chapters/move-chapter/handler";
export { getChapterGraphHandler as getChapterGraph } from "./features/graph/get-chapter-graph/handler";
export { saveChapterGraphHandler as saveChapterGraph } from "./features/graph/save-chapter-graph/handler";
export { publishWorkHandler as publishWork } from "./features/publishing/publish-work/handler";
export { unpublishWorkHandler as unpublishWork } from "./features/publishing/unpublish-work/handler";
export {
  generateWorkSpeechHandler as generateWorkSpeech,
  deleteWorkSpeechHandler as deleteWorkSpeech,
} from "./features/speech/manage-work-speech/handler";
export { getTagCatalogHandler as getTagCatalog } from "./features/tags/get-tag-catalog/handler";
export {
  saveTagGroupHandler as saveTagGroup,
  setTagGroupArchivedHandler as setTagGroupArchived,
  deleteTagGroupHandler as deleteTagGroup,
  reorderTagGroupsHandler as reorderTagGroups,
  saveTagHandler as saveTag,
  setTagArchivedHandler as setTagArchived,
  deleteTagHandler as deleteTag,
  promoteTagHandler as promoteTag,
  reorderTagsHandler as reorderTags,
  updateBadgesHandler as updateTagBadges,
  installTagStarterPackHandler as installTagStarterPack,
} from "./features/tags/manage-tag-catalog/handler";
export {
  saveCastMemberHandler as saveCastMember,
  deleteCastMemberHandler as deleteCastMember,
  reorderCastHandler as reorderCast,
} from "./features/cast/manage-cast/handler";
export { listPublishedWorksHandler as listPublishedWorks } from "./features/reading/list-published-works/handler";
export { getPublishedStoryHandler as getPublishedStory } from "./features/reading/get-published-story/handler";
export { getReaderProgressHandler as getReaderProgress } from "./features/reading/get-reader-progress/handler";
export { saveReaderProgressHandler as saveReaderProgress } from "./features/reading/save-reader-progress/handler";

export { blockDefinitions, blockRenderers } from "./blocks";
export { novelsSeeds } from "./seeds";

export type * from "./contracts/types";
export type { StoryIssue } from "./shared/story-validation";
export type { WorkAdminListItem } from "./features/works/list-works/types";
export type { WorkEditorView, WorkEditorChapter } from "./features/works/get-work/types";
export type { NewWorkFormView } from "./features/works/get-new-work-form/types";
export type { ChapterGraphEditorView } from "./features/graph/get-chapter-graph/types";
export type { PublishedWorkCard, PublishedWorksView } from "./features/reading/list-published-works/types";
export type { TagCatalogAdminView } from "./features/tags/get-tag-catalog/types";
