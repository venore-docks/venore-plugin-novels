"use client";

import Link from "next/link";
import { useState, useSyncExternalStore, useTransition, type FormEvent, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Check, ChevronDown, Eye, Loader2, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { Button, cn, type PickableMedia } from "@venore/plugin-sdk/ui";
import type { CoverFocus, TagCatalog, WorkTagInput } from "../../contracts/types";
import { CoverField } from "../../components/cover-field";
import { TagPicker } from "../../components/tag-picker";
import { WorkCover } from "../../components/work-cover";
import { ADMIN_BASE_PATH } from "../../shared/constants";
import { localeLabel, SUPPORTED_LOCALES } from "../../shared/locales";
import { isValidSlug, slugify } from "../../shared/slug";
import { createWorkAction } from "../admin/actions";

// Assistente de criação de obra (0.9.0): passos em tela cheia, prévia ao vivo do card ao lado,
// rascunho salvo no navegador a cada mudança (fechar e voltar continua de onde parou).

type Draft = {
  step: number;
  title: string;
  subtitle: string;
  synopsis: string;
  slug: string;
  slugTouched: boolean;
  defaultLocale: string;
  locales: string[];
  cover: PickableMedia | null;
  coverFocus: CoverFocus | null;
  tags: WorkTagInput;
};

const DRAFT_KEY = "novels:new-work-draft";
const MAX_SYNOPSIS = 4000;
const EMPTY: Draft = {
  step: 0,
  title: "",
  subtitle: "",
  synopsis: "",
  slug: "",
  slugTouched: false,
  defaultLocale: "pt-BR",
  locales: ["pt-BR"],
  cover: null,
  coverFocus: null,
  tags: { tagIds: [], newTags: [] },
};

const STEPS = [
  { key: "identity", label: "Identidade" },
  { key: "languages", label: "Idiomas" },
  { key: "tags", label: "Tags" },
  { key: "review", label: "Revisão" },
] as const;

// localStorage pode lançar (aba anônima, cota): rascunho é conveniência, nunca bloqueia.
function readDraft(): Draft {
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    return raw ? { ...EMPTY, ...(JSON.parse(raw) as Partial<Draft>) } : EMPTY;
  } catch {
    return EMPTY;
  }
}

function writeDraft(draft: Draft | null) {
  try {
    if (draft) window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    else window.localStorage.removeItem(DRAFT_KEY);
  } catch {
    // sem armazenamento: o assistente segue, só não sobrevive a um reload
  }
}

const noopSubscribe = () => () => {};

export function NewWorkWizard({ tagCatalog }: { tagCatalog: TagCatalog }) {
  // O rascunho mora no navegador: o assistente só monta depois da hidratação.
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);
  if (!hydrated) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-muted-foreground">
        <Loader2 className="size-6 animate-spin" aria-label="Carregando" />
      </div>
    );
  }
  return <Wizard tagCatalog={tagCatalog} />;
}

function Wizard({ tagCatalog }: { tagCatalog: TagCatalog }) {
  const [draft, setDraftState] = useState<Draft>(readDraft);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [creating, startCreating] = useTransition();
  const step = Math.min(draft.step, STEPS.length - 1);

  const update = (patch: Partial<Draft>) =>
    setDraftState((current) => {
      const next = { ...current, ...patch };
      writeDraft(next);
      return next;
    });

  const slug = draft.slugTouched ? draft.slug : slugify(draft.title);
  const identityError = !draft.title.trim()
    ? "Dê um título à obra."
    : !isValidSlug(slug)
      ? "O endereço precisa ter letras minúsculas, números e hífen (em Avançado)."
      : null;
  const missingRequired = tagCatalog.groups.filter((group) => {
    if (!group.required || group.archivedAt) return false;
    const groupTags = new Set(tagCatalog.tags.filter((tag) => tag.groupId === group.id).map((tag) => tag.id));
    return !draft.tags.tagIds.some((id) => groupTags.has(id)) && !draft.tags.newTags.some((tag) => tag.groupId === group.id);
  });

  function goTo(next: number) {
    if (next > 0 && identityError) {
      toast.error(identityError);
      update({ step: 0 });
      return;
    }
    update({ step: Math.max(0, Math.min(next, STEPS.length - 1)) });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function create() {
    if (identityError) {
      goTo(0);
      return;
    }
    startCreating(async () => {
      const result = await createWorkAction({
        title: draft.title,
        subtitle: draft.subtitle,
        synopsis: draft.synopsis,
        slug,
        defaultLocale: draft.defaultLocale,
        locales: draft.locales,
        coverMediaId: draft.cover?.id ?? null,
        coverFocus: draft.cover ? draft.coverFocus : null,
        tags: draft.tags,
      });
      // Sucesso redireciona para o editor do capítulo; só volta aqui com erro.
      if (result && !result.ok) toast.error(result.error);
    });
    writeDraft(null);
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (step === STEPS.length - 1) create();
    else goTo(step + 1);
  }

  const preview = <CardPreview draft={draft} />;

  return (
    <form onSubmit={onSubmit} className="mx-auto w-full max-w-6xl">
      <header className="space-y-4 pb-8">
        <div className="flex items-center justify-between gap-3">
          <Link href={ADMIN_BASE_PATH} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" />
            Obras
          </Link>
          <p className="text-sm text-muted-foreground">
            Passo {step + 1} de {STEPS.length}
          </p>
        </div>
        <ol className="grid grid-cols-4 gap-2" aria-label="Passos">
          {STEPS.map((entry, index) => (
            <li key={entry.key}>
              <button
                type="button"
                onClick={() => goTo(index)}
                aria-current={index === step ? "step" : undefined}
                className="group block w-full space-y-1.5 text-left"
              >
                <span className={cn("block h-1 rounded-full transition-colors", index <= step ? "bg-primary" : "bg-muted")} />
                <span className={cn("hidden text-xs sm:block", index === step ? "font-medium text-foreground" : "text-muted-foreground group-hover:text-foreground")}>
                  {entry.label}
                </span>
              </button>
            </li>
          ))}
        </ol>
      </header>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-w-0">
          {step === 0 && (
            <section className="space-y-10">
              <div className="space-y-3">
                <p className="text-sm font-medium text-primary">Nova obra</p>
                <input
                  autoFocus
                  value={draft.title}
                  onChange={(event) => update({ title: event.target.value })}
                  placeholder="Título da obra"
                  aria-label="Título"
                  maxLength={160}
                  className="w-full bg-transparent font-display text-4xl font-bold leading-tight tracking-tight text-foreground outline-none placeholder:text-muted-foreground/56 sm:text-5xl"
                />
                <input
                  value={draft.subtitle}
                  onChange={(event) => update({ subtitle: event.target.value })}
                  placeholder="Subtítulo (opcional)"
                  aria-label="Subtítulo"
                  maxLength={160}
                  className="w-full bg-transparent text-xl text-muted-foreground outline-none placeholder:text-muted-foreground/56"
                />
              </div>

              <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_14rem]">
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-foreground">Sinopse</span>
                  <textarea
                    value={draft.synopsis}
                    onChange={(event) => update({ synopsis: event.target.value })}
                    maxLength={MAX_SYNOPSIS}
                    rows={9}
                    placeholder="Do que a história trata, sem entregar o final."
                    className="w-full resize-y rounded-xl border border-border bg-card px-4 py-3 font-serif text-base leading-relaxed text-foreground outline-none transition-colors focus:border-ring"
                  />
                  <span className={cn("block text-right text-xs tabular-nums", draft.synopsis.length > MAX_SYNOPSIS * 0.9 ? "text-warning" : "text-muted-foreground")}>
                    {draft.synopsis.length.toLocaleString("pt-BR")} / {MAX_SYNOPSIS.toLocaleString("pt-BR")}
                  </span>
                </label>
                <div className="space-y-2">
                  <span className="text-sm font-medium text-foreground">Capa</span>
                  <CoverField
                    media={draft.cover}
                    focus={draft.coverFocus}
                    onMedia={(cover) => update({ cover })}
                    onFocus={(coverFocus) => update({ coverFocus })}
                  />
                </div>
              </div>

              <div className="rounded-xl border border-border">
                <button
                  type="button"
                  onClick={() => setAdvancedOpen((open) => !open)}
                  aria-expanded={advancedOpen}
                  className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-foreground"
                >
                  Avançado
                  <ChevronDown className={cn("size-4 transition-transform", advancedOpen && "rotate-180")} />
                </button>
                {advancedOpen && (
                  <label className="block space-y-1 border-t border-border px-4 py-3 text-sm">
                    <span className="font-medium text-foreground">Endereço</span>
                    <input
                      value={slug}
                      onChange={(event) => update({ slug: event.target.value, slugTouched: true })}
                      maxLength={80}
                      className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-ring"
                    />
                    <span className="block text-xs text-muted-foreground">/novels/{slug || "…"}</span>
                  </label>
                )}
              </div>
            </section>
          )}

          {step === 1 && (
            <section className="space-y-6">
              <StepTitle title="Em que idiomas a obra vai existir?" hint="O principal é obrigatório. Traduções podem ficar para depois; dá para pular este passo." />
              <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {SUPPORTED_LOCALES.map((locale) => {
                  const included = draft.locales.includes(locale.code);
                  const main = draft.defaultLocale === locale.code;
                  return (
                    <li key={locale.code}>
                      <div
                        className={cn(
                          "flex h-full flex-col gap-3 rounded-xl border p-4 transition-colors",
                          main ? "border-primary bg-primary/10" : included ? "border-ring bg-card" : "border-border bg-card",
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-3xl" aria-hidden>
                            {locale.flag}
                          </span>
                          <span className="font-medium text-foreground">{locale.label}</span>
                        </div>
                        <div className="mt-auto flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant={main ? "default" : "outline"}
                            aria-pressed={main}
                            onClick={() =>
                              update({ defaultLocale: locale.code, locales: included ? draft.locales : [...draft.locales, locale.code] })
                            }
                          >
                            {main ? <Check className="size-4" /> : null}
                            Principal
                          </Button>
                          {!main && (
                            <Button
                              type="button"
                              size="sm"
                              variant={included ? "secondary" : "ghost"}
                              aria-pressed={included}
                              onClick={() =>
                                update({ locales: included ? draft.locales.filter((code) => code !== locale.code) : [...draft.locales, locale.code] })
                              }
                            >
                              {included ? "Tradução incluída" : "Incluir tradução"}
                            </Button>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {step === 2 && (
            <section className="space-y-6">
              <StepTitle title="Como descrever a obra?" hint="As tags ajudam o leitor a achar a obra e a saber o que vai encontrar." />
              <TagPicker catalog={tagCatalog} value={draft.tags} onChange={(tags) => update({ tags })} locale={draft.defaultLocale} />
            </section>
          )}

          {step === 3 && (
            <section className="space-y-6">
              <StepTitle title="Tudo certo?" hint="Depois de criar, a obra abre direto no editor do primeiro capítulo, com uma cena pronta para escrever." />
              <ReviewBlock title="Identidade" onEdit={() => goTo(0)}>
                <p className="font-display text-2xl font-bold text-foreground">{draft.title || "Sem título"}</p>
                {draft.subtitle && <p className="text-muted-foreground">{draft.subtitle}</p>}
                <p className="line-clamp-4 whitespace-pre-line text-sm text-muted-foreground">{draft.synopsis || "Sem sinopse."}</p>
                <p className="text-xs text-muted-foreground">/novels/{slug}</p>
              </ReviewBlock>
              <ReviewBlock title="Idiomas" onEdit={() => goTo(1)}>
                <p className="text-sm text-foreground">
                  {draft.locales.map((code) => `${localeLabel(code)}${code === draft.defaultLocale ? " (principal)" : ""}`).join(" · ")}
                </p>
              </ReviewBlock>
              <ReviewBlock title="Tags" onEdit={() => goTo(2)}>
                <TagSummary catalog={tagCatalog} value={draft.tags} />
                {missingRequired.length > 0 && (
                  <p className="text-xs text-warning">
                    Falta escolher em: {missingRequired.map((group) => group.name["pt-BR"] ?? group.key).join(", ")}. Dá para criar assim; só não
                    publica.
                  </p>
                )}
              </ReviewBlock>
            </section>
          )}
        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-24 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-caps text-muted-foreground">Prévia no catálogo</p>
            {preview}
          </div>
        </aside>
      </div>

      <div className="sticky bottom-0 z-30 -mx-4 mt-10 border-t border-border bg-background/95 backdrop-blur sm:mx-0 sm:rounded-xl sm:border">
        <div className="flex w-full items-center justify-between gap-2 px-4 py-3">
          <Button type="button" variant="ghost" onClick={() => goTo(step - 1)} disabled={step === 0}>
            <ArrowLeft className="size-4" />
            Voltar
          </Button>
          <Button type="button" variant="outline" className="lg:hidden" onClick={() => setPreviewOpen(true)}>
            <Eye className="size-4" />
            Ver prévia
          </Button>
          {step === STEPS.length - 1 ? (
            <Button type="submit" disabled={creating}>
              {creating ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              Criar obra
            </Button>
          ) : (
            <Button type="submit">
              Continuar
              <ArrowRight className="size-4" />
            </Button>
          )}
        </div>
      </div>

      {previewOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Prévia no catálogo">
          <button type="button" aria-label="Fechar prévia" className="absolute inset-0 bg-popover/80" onClick={() => setPreviewOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-2xl border-t border-border bg-background p-6">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">Prévia no catálogo</p>
              <Button type="button" size="icon" variant="ghost" aria-label="Fechar" onClick={() => setPreviewOpen(false)}>
                <X className="size-4" />
              </Button>
            </div>
            <div className="mx-auto max-w-56">{preview}</div>
          </div>
        </div>
      )}
    </form>
  );
}

function StepTitle({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="space-y-2">
      <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">{title}</h1>
      <p className="text-muted-foreground">{hint}</p>
    </div>
  );
}

function ReviewBlock({ title, onEdit, children }: { title: string; onEdit: () => void; children: ReactNode }) {
  return (
    <div className="space-y-2 rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-caps text-muted-foreground">{title}</p>
        <Button type="button" size="sm" variant="ghost" onClick={onEdit}>
          Editar
        </Button>
      </div>
      {children}
    </div>
  );
}

function TagSummary({ catalog, value }: { catalog: TagCatalog; value: WorkTagInput }) {
  const names = [
    ...catalog.tags.filter((tag) => value.tagIds.includes(tag.id)).map((tag) => tag.name["pt-BR"] ?? Object.values(tag.name)[0]),
    ...value.newTags.map((tag) => tag.name),
  ];
  if (names.length === 0) return <p className="text-sm text-muted-foreground">Nenhuma tag escolhida.</p>;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {names.map((tag) => (
        <li key={tag} className="rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs text-foreground">
          {tag}
        </li>
      ))}
    </ul>
  );
}

function CardPreview({ draft }: { draft: Draft }) {
  return (
    <div className="space-y-2">
      <WorkCover url={draft.cover?.url ?? null} focus={draft.coverFocus} title={draft.title} className="shadow-sm" />
      <p className="line-clamp-2 text-sm font-medium text-foreground">{draft.title || "Título da obra"}</p>
      {draft.subtitle && <p className="line-clamp-1 text-xs text-muted-foreground">{draft.subtitle}</p>}
      {draft.synopsis && <p className="line-clamp-4 text-xs text-muted-foreground">{draft.synopsis}</p>}
    </div>
  );
}
