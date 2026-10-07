export const PLUGIN_KEY = "novels";
export const MANAGE_PERMISSION = "novels.works.manage";
export const TAGS_PERMISSION = "novels.tags.manage";
export const PUBLIC_BASE_PATH = "/novels";
export const ADMIN_BASE_PATH = "/admin/novels";

export function publicWorkPath(slug: string): string {
  return `${PUBLIC_BASE_PATH}/${slug}`;
}

export function adminWorkPath(workId: string): string {
  return `${ADMIN_BASE_PATH}/works/${workId}`;
}

export function adminChapterPath(workId: string, chapterId: string): string {
  return `${ADMIN_BASE_PATH}/works/${workId}/chapters/${chapterId}`;
}

export const adminTagsPath = `${ADMIN_BASE_PATH}/tags`;
export const adminNewWorkPath = `${ADMIN_BASE_PATH}/new`;

export function adminWorkTabPath(workId: string, tab: string): string {
  return `${adminWorkPath(workId)}?tab=${tab}`;
}

export function catalogTagPath(slug: string): string {
  return `${PUBLIC_BASE_PATH}?tag=${encodeURIComponent(slug)}`;
}
