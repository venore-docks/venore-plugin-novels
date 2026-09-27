"use client";

import { Fragment, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { RotateCcw, Undo2 } from "lucide-react";
import { Button } from "@venore/plugin-sdk/ui";
import type { ReaderState, Story, StoryScene } from "../../contracts/types";
import { WorkCover } from "../../components/work-cover";
import { pickText, splitParagraphs } from "../../shared/localized-text";
import { localeLabel } from "../../shared/locales";
import {
  choose,
  continueToNextChapter,
  indexStory,
  nextStep,
  reconcileState,
  startStory,
  undoLastChoice,
} from "../../shared/story-engine";
import { saveReaderProgressAction } from "./actions";

type SavedProgress = { state: ReaderState; updatedAt: string };

const LOCALE_KEY = "graphic-novels:locale";
const progressKey = (workId: string) => `graphic-novels:progress:${workId}`;

// localStorage pode lançar (aba anônima, cota, bloqueio): toda leitura/escrita é best-effort.
function writeLocal(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // sem armazenamento local: a leitura continua, só não sobrevive a um reload
  }
}

// localStorage lido via useSyncExternalStore: no servidor (e na hidratação) o snapshot é null,
// e o valor real entra no primeiro render do client sem setState dentro de effect.
function subscribeStorage(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

function readRaw(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function parse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

const noopSubscribe = () => () => {};

export function StoryReader({
  story,
  signedIn,
  serverProgress,
}: {
  story: Story;
  signedIn: boolean;
  serverProgress: SavedProgress | null;
}) {
  const index = useMemo(() => indexStory(story), [story]);
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const storedLocale = useSyncExternalStore(subscribeStorage, () => readRaw(LOCALE_KEY), () => null);
  const storedProgress = useSyncExternalStore(subscribeStorage, () => readRaw(progressKey(story.work.id)), () => null);
  const [chosenLocale, setChosenLocale] = useState<string | null>(null);
  const [state, setState] = useState<ReaderState | null>(null);
  const lastSceneRef = useRef<HTMLElement | null>(null);
  const shouldScroll = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const savedLocale = parse<string>(storedLocale);
  const locale =
    chosenLocale ?? (savedLocale && story.work.locales.includes(savedLocale) ? savedLocale : story.work.defaultLocale);

  // Progresso: o mais recente entre o do navegador e o da conta.
  const saved = useMemo(() => {
    const local = parse<SavedProgress>(storedProgress);
    const newest =
      local && serverProgress
        ? new Date(local.updatedAt) > new Date(serverProgress.updatedAt)
          ? local
          : serverProgress
        : (local ?? serverProgress);
    return newest ? reconcileState(story, index, newest.state) : null;
  }, [storedProgress, serverProgress, story, index]);

  useEffect(() => {
    if (shouldScroll.current && lastSceneRef.current) {
      lastSceneRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      shouldScroll.current = false;
    }
  }, [state]);

  function persist(next: ReaderState) {
    const updatedAt = new Date().toISOString();
    writeLocal(progressKey(story.work.id), { state: next, updatedAt });
    if (!signedIn) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void saveReaderProgressAction(story.work.id, next);
    }, 800);
  }

  function advance(next: ReaderState | null, scroll = true) {
    if (!next) return;
    shouldScroll.current = scroll;
    setState(next);
    persist(next);
  }

  function changeLocale(next: string) {
    setChosenLocale(next);
    writeLocal(LOCALE_KEY, next);
  }

  const { work } = story;
  const t = (text: Record<string, string>) => pickText(text, locale, work.defaultLocale);
  const endingsTotal = story.scenes.filter((scene) => scene.isEnding).length;

  if (!state) {
    return (
      <div className="mx-auto w-full max-w-2xl space-y-6 px-4 py-8">
        <div className="grid gap-6 sm:grid-cols-[12rem_minmax(0,1fr)]">
          <WorkCover url={work.coverUrl} title={t(work.title)} className="mx-auto max-w-48 sm:max-w-none" />
          <div className="space-y-4">
            <h1 className="text-2xl font-semibold text-foreground">{t(work.title)}</h1>
            {t(work.synopsis) && <p className="whitespace-pre-line text-muted-foreground">{t(work.synopsis)}</p>}
            <LocalePicker locales={work.locales} value={locale} onChange={changeLocale} />
            <div className="flex flex-wrap gap-2">
              {hydrated && saved ? (
                <>
                  <Button onClick={() => advance(saved, false)}>Continuar</Button>
                  <Button variant="outline" onClick={() => advance(startStory(story, index, saved.visitedEndings), false)}>
                    Começar de novo
                  </Button>
                </>
              ) : (
                <Button disabled={!hydrated} onClick={() => advance(startStory(story, index, []), false)}>
                  Começar a ler
                </Button>
              )}
            </div>
            {saved && saved.visitedEndings.length > 0 && (
              <p className="text-sm text-muted-foreground">
                Finais descobertos: {saved.visitedEndings.length} de {endingsTotal}
              </p>
            )}
            {!signedIn && (
              <p className="text-xs text-muted-foreground">Seu progresso fica salvo neste navegador. Entre na sua conta para levar para outros aparelhos.</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  const step = nextStep(story, index, state);
  const pathScenes = state.path.map((id) => index.scenesById.get(id)).filter((scene): scene is StoryScene => Boolean(scene));
  const chapterTitle = (chapterId: string) => {
    const chapter = story.chapters.find((candidate) => candidate.id === chapterId);
    const number = [...story.chapters].sort((a, b) => a.position - b.position).findIndex((candidate) => candidate.id === chapterId) + 1;
    return chapter ? `${number}. ${t(chapter.title)}` : "";
  };
  const canUndo = undoLastChoice(story, index, state) !== null;

  return (
    <div className="mx-auto w-full max-w-2xl pb-24">
      <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-2">
        <p className="min-w-0 truncate text-sm font-medium text-foreground">{t(work.title)}</p>
        <div className="flex shrink-0 items-center gap-1">
          <LocalePicker locales={work.locales} value={locale} onChange={changeLocale} compact />
          <Button
            size="icon"
            variant="ghost"
            aria-label="Voltar para a última escolha"
            disabled={!canUndo}
            onClick={() => advance(undoLastChoice(story, index, state))}
          >
            <Undo2 className="size-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Recomeçar"
            onClick={() => {
              if (window.confirm("Recomeçar a história do início? Os finais descobertos continuam salvos.")) {
                advance(startStory(story, index, state.visitedEndings), false);
                window.scrollTo({ top: 0 });
              }
            }}
          >
            <RotateCcw className="size-4" />
          </Button>
        </div>
      </header>

      {pathScenes.map((scene, position) => {
        const previous = pathScenes[position - 1];
        const isLast = position === pathScenes.length - 1;
        return (
          <Fragment key={`${scene.id}-${position}`}>
            {(!previous || previous.chapterId !== scene.chapterId) && (
              <h2 className="px-4 pb-2 pt-10 text-center text-sm font-semibold uppercase tracking-caps text-muted-foreground">
                {chapterTitle(scene.chapterId)}
              </h2>
            )}
            <article ref={isLast ? lastSceneRef : undefined} className="scroll-mt-24 space-y-5 pb-8">
              {scene.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={scene.imageUrl} alt="" loading={position < 2 ? "eager" : "lazy"} className="block w-full" />
              )}
              <div className="space-y-4 px-4 font-serif text-lg leading-relaxed text-foreground">
                {splitParagraphs(t(scene.body)).map((paragraph, paragraphIndex) => (
                  <p key={paragraphIndex} className="whitespace-pre-line">
                    {paragraph}
                  </p>
                ))}
              </div>
            </article>
          </Fragment>
        );
      })}

      <section className="space-y-3 px-4">
        {step.kind === "choices" &&
          step.choices.map((choice) => (
            <Button
              key={choice.id}
              variant="outline"
              className="h-auto w-full justify-start whitespace-normal py-3 text-left"
              onClick={() => {
                const result = choose(story, index, state, choice.id);
                if (result.ok) advance(result.state);
              }}
            >
              {t(choice.label)}
            </Button>
          ))}

        {step.kind === "next-chapter" && (
          <Button
            className="w-full"
            onClick={() => {
              const result = continueToNextChapter(story, index, state);
              if (result.ok) advance(result.state);
            }}
          >
            Próximo capítulo: {chapterTitle(step.chapterId)}
          </Button>
        )}

        {step.kind === "ending" && (
          <div className="space-y-3 rounded-lg border border-border bg-card p-4 text-center">
            <p className="text-xs uppercase tracking-caps text-muted-foreground">Fim</p>
            {t(step.scene.endingTitle) && <p className="text-xl font-semibold text-foreground">{t(step.scene.endingTitle)}</p>}
            <p className="text-sm text-muted-foreground">
              Finais descobertos: {state.visitedEndings.length} de {endingsTotal}
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {canUndo && (
                <Button variant="outline" onClick={() => advance(undoLastChoice(story, index, state))}>
                  Voltar para a última escolha
                </Button>
              )}
              <Button
                onClick={() => {
                  advance(startStory(story, index, state.visitedEndings), false);
                  window.scrollTo({ top: 0 });
                }}
              >
                Ler de novo
              </Button>
            </div>
          </div>
        )}

        {step.kind === "dead-end" && (
          <div className="space-y-3 rounded-lg border border-border bg-card p-4 text-center">
            <p className="text-sm text-muted-foreground">A história continua em breve.</p>
            {canUndo && (
              <Button variant="outline" onClick={() => advance(undoLastChoice(story, index, state))}>
                Voltar para a última escolha
              </Button>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function LocalePicker({
  locales,
  value,
  onChange,
  compact = false,
}: {
  locales: string[];
  value: string;
  onChange: (locale: string) => void;
  compact?: boolean;
}) {
  if (locales.length <= 1) return null;
  return (
    <select
      aria-label="Idioma"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={
        compact
          ? "h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground"
          : "h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground"
      }
    >
      {locales.map((locale) => (
        <option key={locale} value={locale}>
          {localeLabel(locale)}
        </option>
      ))}
    </select>
  );
}
