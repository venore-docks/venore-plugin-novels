"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Button, Input } from "@venore/plugin-sdk/ui";
import type { WorkTags } from "../../contracts/types";
import {
  CONTENT_WARNINGS,
  GENRES,
  MAX_CUSTOM_TAG_LENGTH,
  MAX_CUSTOM_TAGS,
  PRODUCTION_ORIGIN_LABELS,
  PRODUCTION_ORIGINS,
  PRODUCTION_PARTS,
  RATINGS,
  type ContentWarningKey,
  type GenreKey,
  type ProductionOrigin,
  type ProductionPart,
  type RatingKey,
} from "../../shared/tags";

const SELECT_CLASS = "h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground";
const chip = (on: boolean) =>
  on
    ? "rounded-full border border-primary bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
    : "rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground";

function toggle<T>(list: T[], item: T): T[] {
  return list.includes(item) ? list.filter((value) => value !== item) : [...list, item];
}

// Tags da obra (shared/tags.ts). Informativas: gênero (lista + livres), conteúdo e classificação;
// o formato (interativa ou só texto) é calculado do grafo. Produção: como cada parte foi feita.
export function WorkTagsFields({
  tags,
  multilingual,
  onChange,
}: {
  tags: WorkTags;
  multilingual: boolean;
  onChange: (tags: WorkTags) => void;
}) {
  const [custom, setCustom] = useState("");
  const addCustom = () => {
    const tag = custom.trim().replace(/\s+/g, " ").slice(0, MAX_CUSTOM_TAG_LENGTH);
    if (!tag || tags.customGenres.some((existing) => existing.toLowerCase() === tag.toLowerCase())) return;
    onChange({ ...tags, customGenres: [...tags.customGenres, tag].slice(0, MAX_CUSTOM_TAGS) });
    setCustom("");
  };

  return (
    <fieldset className="space-y-4">
      <legend className="text-sm font-medium text-foreground">Tags</legend>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-caps text-muted-foreground">Informativas</p>
        <p className="text-xs text-muted-foreground">Gênero</p>
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(GENRES) as GenreKey[]).map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={tags.genres.includes(key)}
              className={chip(tags.genres.includes(key))}
              onClick={() => onChange({ ...tags, genres: toggle(tags.genres, key) })}
            >
              {GENRES[key]}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {tags.customGenres.map((tag) => (
            <span key={tag} className={`${chip(true)} inline-flex items-center gap-1`}>
              {tag}
              <button
                type="button"
                aria-label={`Remover ${tag}`}
                onClick={() => onChange({ ...tags, customGenres: tags.customGenres.filter((value) => value !== tag) })}
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
        {tags.customGenres.length < MAX_CUSTOM_TAGS && (
          <div className="flex gap-2">
            <Input
              aria-label="Nova tag livre"
              placeholder="Tag livre (ex: Tibia)"
              value={custom}
              maxLength={MAX_CUSTOM_TAG_LENGTH}
              onChange={(event) => setCustom(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addCustom();
                }
              }}
            />
            <Button type="button" variant="outline" size="sm" onClick={addCustom}>
              Adicionar
            </Button>
          </div>
        )}

        <p className="pt-1 text-xs text-muted-foreground">Avisos de conteúdo</p>
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(CONTENT_WARNINGS) as ContentWarningKey[]).map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={tags.content.includes(key)}
              className={chip(tags.content.includes(key))}
              onClick={() => onChange({ ...tags, content: toggle(tags.content, key) })}
            >
              {CONTENT_WARNINGS[key]}
            </button>
          ))}
        </div>

        <label className="flex items-center gap-2 pt-1 text-xs text-muted-foreground">
          Classificação indicativa
          <select
            value={tags.rating ?? ""}
            onChange={(event) => onChange({ ...tags, rating: (event.target.value || null) as RatingKey | null })}
            className={SELECT_CLASS}
          >
            <option value="">Não informada</option>
            {(Object.keys(RATINGS) as RatingKey[]).map((key) => (
              <option key={key} value={key}>
                {RATINGS[key]}
              </option>
            ))}
          </select>
        </label>
        <p className="text-xs text-muted-foreground">
          Formato (interativa ou apenas texto) é mostrado sozinho: interativa quando alguma cena tem mais de uma escolha.
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-caps text-muted-foreground">Produção</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {(Object.keys(PRODUCTION_PARTS) as ProductionPart[])
            .filter((part) => part !== "translation" || multilingual)
            .map((part) => (
              <label key={part} className="flex items-center justify-between gap-2 text-sm">
                <span className="text-muted-foreground">{PRODUCTION_PARTS[part].label}</span>
                <select
                  value={tags.production[part] ?? ""}
                  onChange={(event) => {
                    const production = { ...tags.production };
                    if (event.target.value) production[part] = event.target.value as ProductionOrigin;
                    else delete production[part];
                    onChange({ ...tags, production });
                  }}
                  className={SELECT_CLASS}
                >
                  <option value="">Não informar</option>
                  {PRODUCTION_ORIGINS.map((origin) => (
                    <option key={origin} value={origin}>
                      {PRODUCTION_ORIGIN_LABELS[origin]}
                    </option>
                  ))}
                </select>
              </label>
            ))}
        </div>
        <p className="text-xs text-muted-foreground">A leitura em voz alta aparece sozinha como &quot;Áudio gerado por IA&quot;.</p>
      </div>
    </fieldset>
  );
}
