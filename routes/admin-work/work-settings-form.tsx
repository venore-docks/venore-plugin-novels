"use client";

import { useActionState, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button, Input, MediaPickerField, Textarea, useActionToast } from "@venore/plugin-sdk/ui";
import type { LocalizedText, VariableDefinition, WorkRecord } from "../../contracts/types";
import { LocaleTabs } from "../../components/locale-tabs";
import { localeLabel, SUPPORTED_LOCALES } from "../../shared/locales";
import { updateWorkAction, type AdminActionState } from "../admin/actions";

const initialState: AdminActionState = { error: null };

export function WorkSettingsForm({
  work,
  coverUrl,
  speechStatus,
}: {
  work: WorkRecord;
  coverUrl: string | null;
  speechStatus: string | null;
}) {
  const [state, formAction, pending] = useActionState(updateWorkAction, initialState);
  useActionToast({ pending, error: state.error, successMessage: "Obra salva." });

  const [slug, setSlug] = useState(work.slug);
  const [locales, setLocales] = useState<string[]>(work.locales);
  const [defaultLocale, setDefaultLocale] = useState(work.defaultLocale);
  const [activeLocale, setActiveLocale] = useState(work.defaultLocale);
  const [title, setTitle] = useState<LocalizedText>(work.title);
  const [synopsis, setSynopsis] = useState<LocalizedText>(work.synopsis);
  const [coverMediaId, setCoverMediaId] = useState<string | null>(work.coverMediaId);
  const [variables, setVariables] = useState<VariableDefinition[]>(work.variables);
  const [speechEnabled, setSpeechEnabled] = useState(work.speechEnabled);

  const payload = JSON.stringify({
    workId: work.id,
    slug,
    title,
    synopsis,
    defaultLocale,
    locales,
    coverMediaId,
    variables,
    speechEnabled,
  });
  const editingLocale = locales.includes(activeLocale) ? activeLocale : defaultLocale;

  function toggleLocale(code: string) {
    if (code === defaultLocale) return;
    setLocales((current) => (current.includes(code) ? current.filter((locale) => locale !== code) : [...current, code]));
  }

  function updateVariable(index: number, patch: Partial<VariableDefinition>) {
    setVariables((current) =>
      current.map((variable, position) => {
        if (position !== index) return variable;
        const next = { ...variable, ...patch };
        if (patch.type && patch.type !== variable.type) next.initial = patch.type === "number" ? 0 : false;
        return next;
      }),
    );
  }

  return (
    <form action={formAction} className="space-y-5 rounded-lg border border-border bg-card p-4">
      <input type="hidden" name="payload" value={payload} />

      <MediaPickerField
        name="coverMediaId"
        label="Capa"
        initialMedia={
          work.coverMediaId && coverUrl ? { id: work.coverMediaId, url: coverUrl, filename: "capa", contentType: "image/*" } : null
        }
        onSelect={(media) => setCoverMediaId(media?.id ?? null)}
      />

      <label className="block space-y-1 text-sm">
        <span className="font-medium text-foreground">Endereço</span>
        <Input value={slug} onChange={(event) => setSlug(event.target.value)} maxLength={80} required />
      </label>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-foreground">Idiomas</legend>
        <div className="flex flex-wrap gap-2">
          {SUPPORTED_LOCALES.map((locale) => (
            <label key={locale.code} className="flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-sm">
              <input
                type="checkbox"
                checked={locales.includes(locale.code)}
                disabled={locale.code === defaultLocale}
                onChange={() => toggleLocale(locale.code)}
              />
              {locale.label}
            </label>
          ))}
        </div>
        <label className="block space-y-1 text-sm">
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
      </fieldset>

      <div className="space-y-3">
        <LocaleTabs locales={locales} active={editingLocale} defaultLocale={defaultLocale} onChange={setActiveLocale} />
        <label className="block space-y-1 text-sm">
          <span className="font-medium text-foreground">Título</span>
          <Input
            value={title[editingLocale] ?? ""}
            onChange={(event) => setTitle({ ...title, [editingLocale]: event.target.value })}
            maxLength={160}
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="font-medium text-foreground">Sinopse</span>
          <Textarea
            rows={4}
            value={synopsis[editingLocale] ?? ""}
            onChange={(event) => setSynopsis({ ...synopsis, [editingLocale]: event.target.value })}
            maxLength={4000}
          />
        </label>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-foreground">Variáveis</legend>
        <p className="text-xs text-muted-foreground">
          Guardam o estado da história (ex: coragem, pegou_a_chave). Escolhas podem exigir ou alterar esses valores.
        </p>
        {variables.map((variable, index) => (
          <div key={index} className="space-y-2 rounded-md border border-border p-2">
            <div className="grid grid-cols-2 gap-2">
              <Input
                aria-label="Chave"
                placeholder="chave"
                value={variable.key}
                onChange={(event) => updateVariable(index, { key: event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") })}
                maxLength={40}
              />
              <Input
                aria-label="Nome"
                placeholder="Nome"
                value={variable.label}
                onChange={(event) => updateVariable(index, { label: event.target.value })}
                maxLength={80}
              />
            </div>
            <div className="flex items-center gap-2">
              <select
                aria-label="Tipo"
                value={variable.type}
                onChange={(event) => updateVariable(index, { type: event.target.value as VariableDefinition["type"] })}
                className="h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground"
              >
                <option value="number">Número</option>
                <option value="boolean">Sim/não</option>
              </select>
              <span className="text-xs text-muted-foreground">começa em</span>
              {variable.type === "number" ? (
                <Input
                  aria-label="Valor inicial"
                  type="number"
                  value={String(variable.initial)}
                  onChange={(event) => updateVariable(index, { initial: Number(event.target.value) || 0 })}
                  className="w-20"
                />
              ) : (
                <select
                  aria-label="Valor inicial"
                  value={variable.initial ? "true" : "false"}
                  onChange={(event) => updateVariable(index, { initial: event.target.value === "true" })}
                  className="h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground"
                >
                  <option value="false">Não</option>
                  <option value="true">Sim</option>
                </select>
              )}
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="ml-auto"
                aria-label="Remover variável"
                onClick={() => setVariables(variables.filter((_, position) => position !== index))}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setVariables([...variables, { key: "", label: "", type: "number", initial: 0 }])}
        >
          <Plus className="size-4" />
          Variável
        </Button>
      </fieldset>

      <div className="space-y-1">
        <label className="flex items-center gap-2 text-sm font-medium text-foreground">
          <input
            type="checkbox"
            checked={speechEnabled}
            onChange={(event) => setSpeechEnabled(event.target.checked)}
            className="size-4 rounded-sm border-border"
          />
          Gerar áudio (leitura em voz alta)
        </label>
        <p className="text-xs text-muted-foreground">
          {speechStatus ??
            "Cada cena ganha uma faixa em cada idioma com texto próprio, depois de publicada. Desligar apaga o áudio desta obra."}
        </p>
      </div>

      <Button type="submit" disabled={pending} className="w-full">
        Salvar obra
      </Button>
    </form>
  );
}
