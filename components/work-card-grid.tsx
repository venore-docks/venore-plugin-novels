import Link from "next/link";
import type { CatalogBadges } from "../contracts/types";
import type { PublishedWorkCard } from "../features/reading/list-published-works/types";
import { publicWorkPath } from "../shared/constants";
import { pickText } from "../shared/localized-text";
import { TagChips } from "./work-tags";
import { WorkCover } from "./work-cover";

export function WorkCardGrid({ works, badges }: { works: PublishedWorkCard[]; badges: CatalogBadges }) {
  return (
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {works.map((work) => {
        const t = (text: Record<string, string>) => pickText(text, work.defaultLocale, work.defaultLocale);
        const title = t(work.title);
        const format = t(work.interactive ? badges.interactive : badges.textOnly);
        // Só os grupos marcados "no card" (ex: gênero e classificação), no máximo 4 tags.
        const tags = work.tags.flatMap((group) => group.tags.map((tag) => t(tag.name))).slice(0, 4);
        return (
          <li key={work.id}>
            <Link href={publicWorkPath(work.slug)} className="group block space-y-2">
              <WorkCover url={work.coverUrl} focus={work.coverFocus} title={title} className="transition-opacity group-hover:opacity-90" />
              <div className="space-y-0.5">
                <p className="line-clamp-2 text-sm font-medium text-foreground">{title}</p>
                {t(work.subtitle) && <p className="line-clamp-1 text-xs text-muted-foreground">{t(work.subtitle)}</p>}
              </div>
              <p className="text-xs text-muted-foreground">
                {work.chapterCount} {work.chapterCount === 1 ? "capítulo" : "capítulos"}
                {format && ` · ${format}`}
              </p>
              <TagChips tags={tags} />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
