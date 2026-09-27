const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function isValidSlug(slug: string): boolean {
  return slug.length > 0 && slug.length <= 80 && SLUG_PATTERN.test(slug);
}

export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}
