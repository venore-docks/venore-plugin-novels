"use client";

import { useActionState, useState } from "react";
import { Button, Input, Textarea, useActionToast, type PickableMedia } from "@venore/plugin-sdk/ui";
import type { CoverFocus, LocalizedText, TagCatalog, WorkRecord, WorkTagInput } from "../../contracts/types";
import { CoverField } from "../../components/cover-field";
import { LocaleTabs } from "../../components/locale-tabs";
import { TagPicker } from "../../components/tag-picker";
import { localeLabel, SUPPORTED_LOCALES } from "../../shared/locales";
import { updateWorkAction, type AdminActionState } from "../admin/actions";

const initialState: AdminActionState = { error: null };

// Aba "Configurações": identidade (título, subtítulo, sinopse, capa), idiomas e tags.
export function WorkSettingsForm({
  work,
  coverUrl,
  tagCatalog,
  tagIds,
}: {
  work: WorkRecord;
  coverUrl: string | null;
  tagCatalog: TagCatalog;
  tagIds: string[];
}) {
  const [state, formAction, pending] = useActionState(updateWorkAction, initialState);
  useActionToast({ pending, error: state.error, successMessage: "Obra salva." });

  const [slug, setSlug] = useState(work.slug);
  const [locales, setLocales] = useState<string[]>(work.locales);
  const [defaultLocale, setDefaultLocale] = useState(work.defaultLocale);
  const [activeLocale, setActiveLocale] = useState(work.defaultLocale);
  const [title, setTitle] = useState<LocalizedText>(work.title);
  const [subtitle, setSubtitle] = useState<LocalizedText>(work.subtitle);
  const [synopsis, setSynopsis] = useState<LocalizedText>(work.synopsis);
  const [cover, setCover] = useState<PickableMedia | null>(
    work.coverMediaId && coverUrl ? { id: work.coverMediaId, url: coverUrl, filename: "capa", contentType: "image/*" } : null,
  );
  const [coverFocus, setCoverFocus] = useState<CoverFocus | null>(work.coverFocus);
  const [tags, setTags] = useState<WorkTagInput>({ tagIds, newTags: [] });

  const payload = JSON.stringify({
    workId: work.id,
    slug,
    title,
    subtitle,
    synopsis,
    defaultLocale,
    locales,
    coverMediaId: cover?.id ?? null,
    coverFocus: cover ? coverFocus : null,
    tags,
  });
  const editingLocale = locales.includes(activeLocale) ? activeLocale : defaultLocale;

  function toggleLocale(code: string) {
    if (code === defaultLocale) return;
    setLocales((current) => (current.includes(code) ? current.filter((locale) => locale !== code) : [...current, code]));
  }

  return (
    <form action={formAction} className="space-y-8">
      <input type="hidden" name="payload" value={payload} />

      <section className="grid gap-8 rounded-xl border border-border bg-card p-4 sm:p-6 md:grid-cols-[minmax(0,1fr)_14rem]">
        <div className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-caps text-muted-foreground">Identidade</h2>
          <LocaleTabs locales={locales} active={editingLocale} defaultLocale={defaultLocale} onChange={setActiveLocale} />
          <label className="block space-y-1 text-sm">
            <span className="font-medium text-foreground">Título</span>
            <Input
              value={title[editingLocale] ?? ""}
              onChange={(event) => setTitle({ ...title, [editingLocale]: event.target.value })}
              maxLength={160}
              className="font-display text-lg"
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-medium text-foreground">Subtítulo</span>
            <Input value={subtitle[editingLocale] ?? ""} onChange={(event) => setSubtitle({ ...subtitle, [editingLocale]: event.target.value })} maxLength={160} />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-medium text-foreground">Sinopse</span>
            <Textarea
              rows={6}
              value={synopsis[editingLocale] ?? ""}
              onChange={(event) => setSynopsis({ ...synopsis, [editingLocale]: event.target.value })}
              maxLength={4000}
            />
            <span className="block text-right text-xs tabular-nums text-muted-foreground">{(synopsis[editingLocale] ?? "").length} / 4000</span>
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-medium text-foreground">Endereço</span>
            <Input value={slug} onChange={(event) => setSlug(event.target.value)} maxLength={80} required />
            <span className="text-xs text-muted-foreground">/novels/{slug}</span>
          </label>
        </div>
        <div className="space-y-2">
          <span className="text-sm font-medium text-foreground">Capa</span>
          <CoverField media={cover} focus={coverFocus} onMedia={setCover} onFocus={setCoverFocus} />
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-border bg-card p-4 sm:p-6">
        <h2 className="text-sm font-semibold uppercase tracking-caps text-muted-foreground">Idiomas</h2>
        <div className="flex flex-wrap gap-2">
          {SUPPORTED_LOCALES.map((locale) => (
            <label key={locale.code} className="flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-sm">
              <input type="checkbox" checked={locales.includes(locale.code)} disabled={locale.code === defaultLocale} onChange={() => toggleLocale(locale.code)} />
              <span aria-hidden>{locale.flag}</span>
              {locale.label}
            </label>
          ))}
        </div>
        <label className="block max-w-xs space-y-1 text-sm">
          <span className="text-muted-foreground">Idioma principal</span>
          <select
            value={defaultLocale}
            onChange={(event) => setDefaultLocale(event.target.value)}
            className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground"
          >
            {locales.map((locale) => (
              <option key={locale} value={locale}>
                {localeLabel(locale)}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="space-y-4 rounded-xl border border-border bg-card p-4 sm:p-6">
        <h2 className="text-sm font-semibold uppercase tracking-caps text-muted-foreground">Tags</h2>
        <TagPicker catalog={tagCatalog} value={tags} onChange={setTags} locale={defaultLocale} />
      </section>

      <div className="sticky bottom-0 z-10 -mx-4 border-t border-border bg-background/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:border">
        <Button type="submit" disabled={pending} className="w-full sm:w-auto">
          Salvar configurações
        </Button>
      </div>
    </form>
  );
}
