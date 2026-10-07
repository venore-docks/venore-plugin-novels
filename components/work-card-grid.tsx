import Link from "next/link";
import type { PublishedWorkCard } from "../features/reading/list-published-works/types";
import { publicWorkPath } from "../shared/constants";
import { pickText } from "../shared/localized-text";
import { CONTENT_WARNINGS, GENRES, RATINGS } from "../shared/tags";
import { TagChips } from "./work-tags";
import { WorkCover } from "./work-cover";

export function WorkCardGrid({ works }: { works: PublishedWorkCard[] }) {
  return (
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {works.map((work) => {
        const title = pickText(work.title, work.defaultLocale, work.defaultLocale);
        return (
          <li key={work.id}>
            <Link href={publicWorkPath(work.slug)} className="group block space-y-2">
              <WorkCover url={work.coverUrl} title={title} className="transition-opacity group-hover:opacity-90" />
              <p className="line-clamp-2 text-sm font-medium text-foreground">{title}</p>
              <p className="text-xs text-muted-foreground">
                {work.chapterCount} {work.chapterCount === 1 ? "capítulo" : "capítulos"} · {work.interactive ? "Interativa" : "Apenas texto"}
                {work.tags.rating && ` · ${RATINGS[work.tags.rating]}`}
              </p>
              <TagChips
                tags={[
                  ...work.tags.genres.map((key) => GENRES[key]),
                  ...work.tags.customGenres,
                  ...work.tags.content.map((key) => CONTENT_WARNINGS[key]),
                ].slice(0, 4)}
              />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
