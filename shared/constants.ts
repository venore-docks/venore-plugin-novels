export const PLUGIN_KEY = "novels";
export const MANAGE_PERMISSION = "novels.works.manage";
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
