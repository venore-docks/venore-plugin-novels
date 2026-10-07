"use client";

import { useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Plus, Search, X } from "lucide-react";
import { cn } from "@venore/plugin-sdk/ui";
import type { LocalizedText, TagGroupRecord, TagRecord, WorkTagInput } from "../contracts/types";
import { pickText } from "../shared/localized-text";
import { cleanTagName, MAX_CUSTOM_TAGS_PER_GROUP } from "../shared/tag-catalog";

type Catalog = { groups: TagGroupRecord[]; tags: TagRecord[] };

const SEGMENTED_MAX = 4;

// Seleção das tags da obra (assistente e aba Configurações). Um bloco por grupo do catálogo:
// várias opções = chips + "Adicionar…" com busca e teclado (e "Criar" quando o grupo aceita tag
// livre); uma opção com até 4 tags = botões segmentados; mais que isso = lista suspensa.
export function TagPicker({
  catalog,
  value,
  onChange,
  locale,
  className,
}: {
  catalog: Catalog;
  value: WorkTagInput;
  onChange: (value: WorkTagInput) => void;
  locale: string;
  className?: string;
}) {
  const t = (text: LocalizedText) => pickText(text, locale, "pt-BR");
  const selected = new Set(value.tagIds);
  const groups = [...catalog.groups]
    .sort((a, b) => a.position - b.position)
    .filter((group) => !group.archivedAt || catalog.tags.some((tag) => tag.groupId === group.id && selected.has(tag.id)));
  const info = groups.filter((group) => group.category === "info");
  const production = groups.filter((group) => group.category === "production");

  if (groups.length === 0) {
    return (
      <p className={cn("rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground", className)}>
        O catálogo de tags está vazio. Quem cuida do catálogo cadastra os grupos em Graphic Novels → Tags.
      </p>
    );
  }

  const groupProps = { catalog, value, onChange, t };
  return (
    <div className={cn("space-y-8", className)}>
      {info.length > 0 && (
        <section className="space-y-5">
          <h3 className="text-xs font-semibold uppercase tracking-caps text-muted-foreground">Sobre a obra</h3>
          {info.map((group) => (
            <TagGroupField key={group.id} group={group} {...groupProps} />
          ))}
        </section>
      )}
      {production.length > 0 && (
        <section className="space-y-5">
          <div className="space-y-1">
            <h3 className="text-xs font-semibold uppercase tracking-caps text-muted-foreground">Como foi feita</h3>
            <p className="text-xs text-muted-foreground">Transparência para o leitor: quem fez cada parte da obra.</p>
          </div>
          <div className="grid gap-5 xl:grid-cols-2">
            {production.map((group) => (
              <TagGroupField key={group.id} group={group} {...groupProps} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function TagGroupField({
  group,
  catalog,
  value,
  onChange,
  t,
}: {
  group: TagGroupRecord;
  catalog: Catalog;
  value: WorkTagInput;
  onChange: (value: WorkTagInput) => void;
  t: (text: LocalizedText) => string;
}) {
  const selected = new Set(value.tagIds);
  const groupTags = catalog.tags.filter((tag) => tag.groupId === group.id).sort((a, b) => a.position - b.position);
  // Opções: do catálogo oficial e não arquivadas; o que já está escolhido aparece sempre.
  const options = groupTags.filter((tag) => !tag.custom && !tag.archivedAt && !group.archivedAt);
  const chosen = groupTags.filter((tag) => selected.has(tag.id));
  const newOnes = value.newTags.filter((tag) => tag.groupId === group.id);
  const empty = chosen.length === 0 && newOnes.length === 0;

  const setGroup = (tagIds: string[], newTags = newOnes) =>
    onChange({
      tagIds: [...value.tagIds.filter((id) => !groupTags.some((tag) => tag.id === id)), ...tagIds],
      newTags: [...value.newTags.filter((tag) => tag.groupId !== group.id), ...newTags],
    });

  const header = (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <p className="text-sm font-medium text-foreground">
        {t(group.name)}
        {group.required && <span className="ms-1 text-destructive" aria-label="obrigatório">*</span>}
      </p>
      <p className="text-xs text-muted-foreground">{group.selection === "single" ? "Uma opção" : "Várias opções"}</p>
    </div>
  );
  const warning = group.required && empty && (
    <p className="text-xs text-warning">Obrigatório para publicar.</p>
  );

  if (group.selection === "single" && options.length + chosen.filter((tag) => !options.includes(tag)).length <= SEGMENTED_MAX && !group.allowCustom) {
    const list = [...options, ...chosen.filter((tag) => !options.includes(tag))];
    return (
      <div className="space-y-2">
        {header}
        <div role="radiogroup" aria-label={t(group.name)} className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
          {list.map((tag) => {
            const on = selected.has(tag.id);
            return (
              <button
                key={tag.id}
                type="button"
                role="radio"
                aria-checked={on}
                title={t(tag.description) || undefined}
                onClick={() => setGroup(on ? [] : [tag.id], [])}
                className={cn(
                  "flex-1 rounded-md px-3 py-1.5 text-sm transition-colors",
                  on ? "bg-card font-medium text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t(tag.name)}
              </button>
            );
          })}
        </div>
        {warning}
      </div>
    );
  }

  if (group.selection === "single" && !group.allowCustom) {
    return (
      <label className="block space-y-2">
        {header}
        <select
          value={chosen[0]?.id ?? ""}
          onChange={(event) => setGroup(event.target.value ? [event.target.value] : [], [])}
          className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground"
        >
          <option value="">Não informar</option>
          {[...options, ...chosen.filter((tag) => !options.includes(tag))].map((tag) => (
            <option key={tag.id} value={tag.id}>
              {t(tag.name)}
            </option>
          ))}
        </select>
        {warning}
      </label>
    );
  }

  return (
    <div className="space-y-2">
      {header}
      <div className="flex flex-wrap items-center gap-1.5">
        {chosen.map((tag) => (
          <Chip key={tag.id} label={t(tag.name)} hint={tag.custom ? "tag livre" : t(tag.description)} onRemove={() => setGroup(chosen.filter((other) => other.id !== tag.id).map((other) => other.id))} />
        ))}
        {newOnes.map((tag) => (
          <Chip
            key={`new-${tag.name}`}
            label={tag.name}
            hint="nova tag livre"
            fresh
            onRemove={() => setGroup(chosen.map((other) => other.id), newOnes.filter((other) => other.name !== tag.name))}
          />
        ))}
        <TagCombobox
          group={group}
          options={options.filter((tag) => !selected.has(tag.id))}
          t={t}
          canCreate={group.allowCustom && newOnes.length < MAX_CUSTOM_TAGS_PER_GROUP}
          takenNames={[...chosen.map((tag) => t(tag.name)), ...newOnes.map((tag) => tag.name)]}
          onPick={(tagId) => setGroup(group.selection === "single" ? [tagId] : [...chosen.map((tag) => tag.id), tagId], group.selection === "single" ? [] : newOnes)}
          onCreate={(name) =>
            group.selection === "single"
              ? setGroup([], [{ groupId: group.id, name }])
              : setGroup(chosen.map((tag) => tag.id), [...newOnes, { groupId: group.id, name }])
          }
        />
      </div>
      {warning}
    </div>
  );
}

function Chip({ label, hint, fresh, onRemove }: { label: string; hint?: string; fresh?: boolean; onRemove: () => void }) {
  return (
    <span
      title={hint || undefined}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border py-1 pe-1 ps-3 text-sm",
        fresh ? "border-dashed border-primary bg-primary/10 text-primary" : "border-primary/30 bg-primary/10 text-foreground",
      )}
    >
      {label}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remover ${label}`}
        className="rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
      >
        <X className="size-3.5" />
      </button>
    </span>
  );
}

function TagCombobox({
  group,
  options,
  t,
  canCreate,
  takenNames,
  onPick,
  onCreate,
}: {
  group: TagGroupRecord;
  options: TagRecord[];
  t: (text: LocalizedText) => string;
  canCreate: boolean;
  takenNames: string[];
  onPick: (tagId: string) => void;
  onCreate: (name: string) => void;
}) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const normalized = query.trim().toLowerCase();
  const filtered = useMemo(
    () => options.filter((tag) => !normalized || Object.values(tag.name).some((name) => name.toLowerCase().includes(normalized))),
    [options, normalized],
  );
  const name = cleanTagName(query);
  const exact =
    filtered.some((tag) => Object.values(tag.name).some((value) => value.toLowerCase() === normalized)) ||
    takenNames.some((taken) => taken.toLowerCase() === normalized);
  const items: ({ kind: "tag"; tag: TagRecord } | { kind: "create"; name: string })[] = [
    ...filtered.map((tag) => ({ kind: "tag" as const, tag })),
    ...(canCreate && name && !exact ? [{ kind: "create" as const, name }] : []),
  ];

  function choose(index: number) {
    const item = items[index];
    if (!item) return;
    if (item.kind === "tag") onPick(item.tag.id);
    else onCreate(item.name);
    setQuery("");
    setActive(0);
    inputRef.current?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActive((current) => Math.min(current + 1, Math.max(items.length - 1, 0)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((current) => Math.max(current - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (open) choose(active);
    } else if (event.key === "Escape") {
      setOpen(false);
    } else if (event.key === "Backspace" && !query) {
      setOpen(false);
    }
  }

  if (options.length === 0 && !canCreate) return null;
  return (
    <div className="relative">
      <div className="flex h-8 items-center gap-1.5 rounded-full border border-dashed border-border px-3 text-sm text-muted-foreground focus-within:border-ring">
        {open ? <Search className="size-3.5 shrink-0" aria-hidden /> : <Plus className="size-3.5 shrink-0" aria-hidden />}
        <input
          ref={inputRef}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && items[active] ? `${listId}-${active}` : undefined}
          aria-label={`Adicionar em ${t(group.name)}`}
          placeholder={group.allowCustom ? "Adicionar ou criar…" : "Adicionar…"}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={onKeyDown}
          maxLength={40}
          className="w-36 bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
        />
      </div>
      {open && items.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute start-0 top-full z-30 mt-1 max-h-64 w-64 overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-lg"
        >
          {items.map((item, index) => (
            <li
              key={item.kind === "tag" ? item.tag.id : "create"}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === active}
              onMouseDown={(event) => {
                event.preventDefault();
                choose(index);
              }}
              onMouseEnter={() => setActive(index)}
              className={cn(
                "cursor-pointer rounded-md px-2.5 py-1.5 text-sm",
                index === active ? "bg-accent/14 text-foreground" : "text-foreground",
              )}
            >
              {item.kind === "tag" ? (
                <span className="block">
                  {t(item.tag.name)}
                  {t(item.tag.description) && <span className="block text-xs text-muted-foreground">{t(item.tag.description)}</span>}
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-primary">
                  <Plus className="size-3.5" aria-hidden />
                  Criar &ldquo;{item.name}&rdquo;
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
