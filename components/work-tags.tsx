import Link from "next/link";
import type { LocalizedText, WorkTagGroupView } from "../contracts/types";
import { catalogTagPath } from "../shared/constants";
import { pickText } from "../shared/localized-text";

// Tags da obra em grupos (informativas e de produção), mais os selos calculados (formato, áudio).
// Sem estado: serve à capa do leitor (client) e ao catálogo (server). Cada tag leva ao catálogo
// filtrado por ela.
export function WorkTagGroups({
  groups,
  badges = [],
  locale,
  fallbackLocale,
  className,
}: {
  groups: WorkTagGroupView[];
  badges?: LocalizedText[];
  locale: string;
  fallbackLocale: string;
  className?: string;
}) {
  const t = (text: LocalizedText) => pickText(text, locale, fallbackLocale);
  if (groups.length === 0 && badges.length === 0) return null;
  const info = groups.filter((group) => group.category === "info");
  const production = groups.filter((group) => group.category === "production");
  return (
    <div className={className ?? "space-y-3"}>
      {badges.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {badges.map((badge) => (
            <li key={t(badge)} className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
              {t(badge)}
            </li>
          ))}
        </ul>
      )}
      {[info, production].map((list, index) =>
        list.length === 0 ? null : (
          <dl key={index} className="space-y-1.5">
            {index === 1 && <p className="text-xs font-semibold uppercase tracking-caps text-muted-foreground">Produção</p>}
            {list.map((group) => (
              <div key={group.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <dt className="text-xs font-semibold uppercase tracking-caps text-muted-foreground">{t(group.name)}</dt>
                {group.tags.map((tag) => (
                  <dd key={tag.id}>
                    <Link
                      href={catalogTagPath(tag.slug)}
                      title={t(tag.description) || undefined}
                      className="inline-block rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs text-foreground transition-colors hover:border-ring"
                    >
                      {t(tag.name)}
                    </Link>
                  </dd>
                ))}
              </div>
            ))}
          </dl>
        ),
      )}
    </div>
  );
}

export function TagChips({ tags }: { tags: string[] }) {
  if (tags.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-1">
      {tags.map((tag) => (
        <li key={tag} className="rounded-full border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          {tag}
        </li>
      ))}
    </ul>
  );
}
