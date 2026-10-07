"use client";

import { Fragment, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Pause, Play, RotateCcw, Undo2, Volume2, VolumeX } from "lucide-react";
import { Button } from "@venore/plugin-sdk/ui";
import type { ReaderState, Story, StoryScene } from "../../contracts/types";
import { WorkCover } from "../../components/work-cover";
import { pickText } from "../../shared/localized-text";
import { localeLabel } from "../../shared/locales";
import {
  choose,
  continueToNextChapter,
  indexStory,
  initialVariables,
  nextStep,
  reconcileState,
  startStory,
  undoLastChoice,
  varsAlongPath,
} from "../../shared/story-engine";
import { isInteractive } from "../../shared/build-story";
import { computedBadges } from "../../shared/tag-catalog";
import { SceneBlocksView } from "../../components/scene-blocks-view";
import { characterSheet, describeChanges, hasCharacterSheet } from "../../shared/variables";
import { WorkTagGroups } from "../../components/work-tags";
import { ChangeChips, CharacterDialog, ReaderHud } from "./character-panel";
import { saveReaderProgressAction } from "./actions";

type SavedProgress = { state: ReaderState; updatedAt: string };

const LOCALE_KEY = "novels:locale";
const AUTO_READ_KEY = "novels:auto-read";
const progressKey = (workId: string) => `novels:progress:${workId}`;

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
  const storedAutoRead = useSyncExternalStore(subscribeStorage, () => readRaw(AUTO_READ_KEY), () => null);
  const [chosenLocale, setChosenLocale] = useState<string | null>(null);
  const [chosenAutoRead, setChosenAutoRead] = useState<boolean | null>(null);
  const [state, setState] = useState<ReaderState | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  // Um <audio> só para a obra inteira: tocar outra cena troca a fonte. playingSceneId == null é
  // parado ou pausado.
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioSceneRef = useRef<string | null>(null);
  const [playingSceneId, setPlayingSceneId] = useState<string | null>(null);
  const lastSceneRef = useRef<HTMLElement | null>(null);
  const shouldScroll = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const savedLocale = parse<string>(storedLocale);
  const locale =
    chosenLocale ?? (savedLocale && story.work.locales.includes(savedLocale) ? savedLocale : story.work.defaultLocale);
  const autoRead = chosenAutoRead ?? parse<boolean>(storedAutoRead) === true;
  const audioFor = (sceneId: string) => story.audio[sceneId]?.[locale] ?? null;
  const hasAudio = story.scenes.some((scene) => audioFor(scene.id));

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

  // Chamado dentro do clique (escolha, continuar, ouvir): o Safari do iPhone só deixa tocar áudio
  // a partir de um gesto, não de um effect depois do render.
  function playScene(sceneId: string) {
    const audio = audioRef.current;
    const url = audioFor(sceneId);
    if (!audio || !url) return;
    // Trocar a fonte dispara "pause" do áudio anterior antes do "play" deste: o estado vem dos
    // eventos do elemento (onPlay/onPause), não daqui.
    audioSceneRef.current = sceneId;
    if (audio.getAttribute("src") !== url) audio.setAttribute("src", url);
    void audio.play().catch(() => setPlayingSceneId(null));
  }

  function stopAudio() {
    audioRef.current?.pause();
    setPlayingSceneId(null);
  }

  function toggleScene(sceneId: string) {
    if (playingSceneId === sceneId) stopAudio();
    else playScene(sceneId);
  }

  function advance(next: ReaderState | null, scroll = true) {
    if (!next) return;
    shouldScroll.current = scroll;
    setState(next);
    persist(next);
    const lastSceneId = next.path[next.path.length - 1];
    if (autoRead && lastSceneId) playScene(lastSceneId);
    else stopAudio();
  }

  function changeLocale(next: string) {
    stopAudio();
    setChosenLocale(next);
    writeLocal(LOCALE_KEY, next);
  }

  function setAutoRead(next: boolean) {
    setChosenAutoRead(next);
    writeLocal(AUTO_READ_KEY, next);
  }

  function toggleAutoRead() {
    const next = !autoRead;
    setAutoRead(next);
    const lastSceneId = state?.path[state.path.length - 1];
    if (next && lastSceneId) playScene(lastSceneId);
    if (!next) stopAudio();
  }

  const audioElement = (
    // Sem controles próprios: os botões de cada cena comandam. A transcrição é o próprio texto da
    // cena, sempre visível.
    <audio
      ref={audioRef}
      preload="none"
      onPlay={() => setPlayingSceneId(audioSceneRef.current)}
      onPause={() => setPlayingSceneId(null)}
      onEnded={() => setPlayingSceneId(null)}
      className="hidden"
    />
  );

  const { work } = story;
  const t = (text: Record<string, string>) => pickText(text, locale, work.defaultLocale);
  const endingsTotal = story.scenes.filter((scene) => scene.isEnding).length;
  // Selos calculados (interativa ou só texto, áudio gerado): o autor nunca escolhe.
  const badges = computedBadges(story.badges, { interactive: isInteractive(story.choices), hasAudio });

  if (!state) {
    return (
      <div className="mx-auto w-full max-w-2xl space-y-6 px-4 py-8">
        {audioElement}
        <div className="grid gap-6 sm:grid-cols-[12rem_minmax(0,1fr)]">
          <WorkCover url={work.coverUrl} focus={work.coverFocus} title={t(work.title)} className="mx-auto max-w-48 sm:max-w-none" />
          <div className="space-y-4">
            <div className="space-y-1">
              <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">{t(work.title)}</h1>
              {t(work.subtitle) && <p className="text-lg text-muted-foreground">{t(work.subtitle)}</p>}
            </div>
            {t(work.synopsis) && <p className="whitespace-pre-line text-muted-foreground">{t(work.synopsis)}</p>}
            <WorkTagGroups groups={work.tags} badges={badges} locale={locale} fallbackLocale={work.defaultLocale} />
            <LocalePicker locales={work.locales} value={locale} onChange={changeLocale} />
            {hasAudio && (
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={autoRead}
                  onChange={(event) => setAutoRead(event.target.checked)}
                  className="size-4 rounded-sm border-border"
                />
                Ler em voz alta enquanto avanço
              </label>
            )}
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
  // Painel do personagem e o que mudou em cada cena (só variáveis marcadas para o leitor).
  const showSheet = hasCharacterSheet(work.variables);
  const sheet = showSheet ? characterSheet(state.vars, work.variables) : null;
  const varsByStep = showSheet ? varsAlongPath(story, index, state.path) : [];
  const startVars = showSheet ? initialVariables(work.variables) : {};
  const changesAt = (position: number) =>
    showSheet && varsByStep[position]
      ? describeChanges(position === 0 ? startVars : varsByStep[position - 1], varsByStep[position], work.variables)
      : [];

  return (
    <div className={sheet ? "mx-auto w-full max-w-2xl pb-40" : "mx-auto w-full max-w-2xl pb-24"}>
      {audioElement}
      <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-2">
        <p className="min-w-0 truncate text-sm font-medium text-foreground">{t(work.title)}</p>
        <div className="flex shrink-0 items-center gap-1">
          <LocalePicker locales={work.locales} value={locale} onChange={changeLocale} compact />
          {hasAudio && (
            <Button
              size="icon"
              variant={autoRead ? "secondary" : "ghost"}
              aria-label={autoRead ? "Parar a leitura em voz alta" : "Ler em voz alta"}
              aria-pressed={autoRead}
              onClick={toggleAutoRead}
            >
              {autoRead ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
            </Button>
          )}
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
      {sheet && <CharacterDialog sheet={sheet} title={t(work.title)} open={sheetOpen} onOpenChange={setSheetOpen} />}
      {sheet && <ReaderHud sheet={sheet} onOpen={() => setSheetOpen(true)} />}

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
              {audioFor(scene.id) && (
                <div className="px-4">
                  <Button
                    size="sm"
                    variant="outline"
                    aria-pressed={playingSceneId === scene.id}
                    onClick={() => toggleScene(scene.id)}
                  >
                    {playingSceneId === scene.id ? <Pause className="size-4" /> : <Play className="size-4" />}
                    {playingSceneId === scene.id ? "Pausar" : "Ouvir"}
                  </Button>
                </div>
              )}
              <SceneBlocksView
                blocks={scene.blocks}
                locale={locale}
                fallbackLocale={work.defaultLocale}
                media={story.media}
                cast={story.cast}
                eager={position < 2}
              />
              <ChangeChips changes={changesAt(position)} />
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
