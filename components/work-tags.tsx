import type { TagGroup } from "../shared/tags";

// Tags da obra em grupos (gênero, formato, classificação, conteúdo; produção à parte). Sem estado:
// serve à capa do leitor (client) e ao catálogo (server).
export function WorkTagGroups({ groups, className }: { groups: TagGroup[]; className?: string }) {
  if (groups.length === 0) return null;
  return (
    <dl className={className ?? "space-y-2"}>
      {groups.map((group) => (
        <div key={group.label} className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <dt className="text-xs font-semibold uppercase tracking-caps text-muted-foreground">{group.label}</dt>
          {group.tags.map((tag) => (
            <dd key={tag} className="rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs text-foreground">
              {tag}
            </dd>
          ))}
        </div>
      ))}
    </dl>
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
