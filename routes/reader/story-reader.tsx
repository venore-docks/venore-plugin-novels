"use client";

import { Fragment, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ComponentType } from "react";
import { Dices, History, Pause, Play, RotateCcw, Save, Undo2, Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";
import { Button, cn } from "@venore/plugin-sdk/ui";
import type { LocalizedText, ReaderState, Story, VariableValue } from "../../contracts/types";
import { WorkCover } from "../../components/work-cover";
import { SceneBlocksView } from "../../components/scene-blocks-view";
import { WorkTagGroups } from "../../components/work-tags";
import { ACCENT_CLASSES } from "../../shared/accent";
import { isInteractive } from "../../shared/build-story";
import { createContext } from "../../shared/engine/context";
import { evaluateNumber } from "../../shared/engine/formula";
import { interpolateBlocks, interpolateText } from "../../shared/engine/interpolate";
import { applyAction, fromLegacy, isSavedGame, newGame, nextStep, replay, toSaved, undo, type ChoiceView } from "../../shared/engine/play";
import { playerScope } from "../../shared/engine/rules";
import { buildSheet } from "../../shared/engine/sheet";
import type { GameState, PlayAction, SavedGame } from "../../shared/engine/types";
import { localeLabel } from "../../shared/locales";
import { pickText } from "../../shared/localized-text";
import { computedBadges } from "../../shared/tag-catalog";
import { saveReaderProgressAction, startReaderGameAction } from "./actions";
import { CharacterCreation } from "./character-creation";
import { DiceRoll } from "./dice-roll";
import { ChangeChips, CombatLog, formatNumber, GameHud, SheetDialog } from "./game-hud";
import { CombatPanel, HistoryDialog, OverflowPanel, SavesDialog, ShopPanel } from "./game-panels";

type ServerProgress = { state: SavedGame | ReaderState; updatedAt: string };
type LocalGame = { saved: SavedGame; updatedAt: string };

const LOCALE_KEY = "novels:locale";
const AUTO_READ_KEY = "novels:auto-read";
const gameKey = (workId: string) => `novels:game:${workId}`;
// Progresso do formato antigo (antes da 0.10.0): lido uma vez e convertido.
const legacyKey = (workId: string) => `novels:progress:${workId}`;

// localStorage pode lançar (aba anônima, cota, bloqueio): toda leitura/escrita é best-effort.
function writeLocal(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // sem armazenamento local: a leitura continua, só não sobrevive a um reload
  }
}

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

function totalRolls(state: GameState | null): number {
  return state ? state.entries.reduce((sum, entry) => sum + entry.rolls.length, 0) : 0;
}

export function StoryReader({
  story,
  signedIn,
  serverProgress,
  carry,
  mode = "public",
  TestPanel,
}: {
  story: Story;
  signedIn: boolean;
  serverProgress: ServerProgress | null;
  // Valores herdados da obra anterior da série (servidor já calculou).
  carry?: Record<string, VariableValue>;
  // "test": modo teste do autor (rascunho, sem salvar, aceita pular para cena).
  mode?: "public" | "test";
  TestPanel?: ComponentType<{ state: GameState | null; jump: (action: Extract<PlayAction, { t: "debug" }>) => void }>;
}) {
  const ctx = useMemo(() => createContext(story, { debug: mode === "test" }), [story, mode]);
  const persistent = mode === "public";
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const storedLocale = useSyncExternalStore(subscribeStorage, () => readRaw(LOCALE_KEY), () => null);
  const storedGame = useSyncExternalStore(subscribeStorage, () => (persistent ? readRaw(gameKey(story.work.id)) : null), () => null);
  const storedLegacy = useSyncExternalStore(subscribeStorage, () => (persistent ? readRaw(legacyKey(story.work.id)) : null), () => null);
  const storedAutoRead = useSyncExternalStore(subscribeStorage, () => readRaw(AUTO_READ_KEY), () => null);
  const [chosenLocale, setChosenLocale] = useState<string | null>(null);
  const [chosenAutoRead, setChosenAutoRead] = useState<boolean | null>(null);
  const [game, setGame] = useState<GameState | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [savesOpen, setSavesOpen] = useState(false);
  // Rolagens com índice a partir daqui animam (as que acabaram de acontecer).
  const [animateFrom, setAnimateFrom] = useState(Number.POSITIVE_INFINITY);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioSceneRef = useRef<string | null>(null);
  const [playingSceneId, setPlayingSceneId] = useState<string | null>(null);
  const lastSceneRef = useRef<HTMLElement | null>(null);
  const shouldScroll = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const savedLocale = parse<string>(storedLocale);
  const locale = chosenLocale ?? (savedLocale && story.work.locales.includes(savedLocale) ? savedLocale : story.work.defaultLocale);
  const autoRead = chosenAutoRead ?? parse<boolean>(storedAutoRead) === true;
  const audioFor = (sceneId: string) => story.audio[sceneId]?.[locale] ?? null;
  const hasAudio = story.scenes.some((scene) => audioFor(scene.id));
  const text = (value: LocalizedText | undefined) => pickText(value ?? {}, locale, story.work.defaultLocale);
  const profileFields = ctx.on("character") ? ctx.system.character.fields : [];

  // Partida salva: a mais recente entre o navegador e a conta, refeita pelo motor.
  const saved = useMemo<GameState | null>(() => {
    if (!persistent) return null;
    const local = parse<LocalGame>(storedGame);
    const legacy = parse<{ state: ReaderState; updatedAt: string }>(storedLegacy);
    const candidates: { state: SavedGame | ReaderState; updatedAt: string }[] = [];
    if (local?.saved) candidates.push({ state: local.saved, updatedAt: local.updatedAt });
    if (legacy?.state) candidates.push(legacy);
    if (serverProgress) candidates.push(serverProgress);
    candidates.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    const newest = candidates[0];
    if (!newest) return null;
    if (isSavedGame(newest.state)) return replay(ctx, newest.state).state;
    return fromLegacy(ctx, newest.state);
  }, [persistent, storedGame, storedLegacy, serverProgress, ctx]);

  useEffect(() => {
    if (shouldScroll.current && lastSceneRef.current) {
      lastSceneRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      shouldScroll.current = false;
    }
  }, [game]);

  function persist(next: GameState) {
    if (!persistent) return;
    const savedGame = toSaved(next);
    writeLocal(gameKey(story.work.id), { saved: savedGame, updatedAt: new Date().toISOString() } satisfies LocalGame);
    if (!signedIn) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void saveReaderProgressAction(story.work.id, savedGame).then((result) => {
        if (!result.ok && result.error === "novels.seed_mismatch") toast.error("Esta partida não é a que está salva na sua conta (outro aparelho?). Recarregue a página.");
      });
    }, 800);
  }

  // Chamado dentro do clique: o Safari do iPhone só deixa tocar áudio a partir de um gesto.
  function playScene(sceneId: string) {
    const audio = audioRef.current;
    const url = audioFor(sceneId);
    if (!audio || !url) return;
    audioSceneRef.current = sceneId;
    if (audio.getAttribute("src") !== url) audio.setAttribute("src", url);
    void audio.play().catch(() => setPlayingSceneId(null));
  }

  function stopAudio() {
    audioRef.current?.pause();
    setPlayingSceneId(null);
  }

  function show(next: GameState, scroll = true, animate = true) {
    const sceneChanged = next.sceneId !== game?.sceneId || next.path.length !== game?.path.length;
    setAnimateFrom(animate ? totalRolls(game) : Number.POSITIVE_INFINITY);
    shouldScroll.current = scroll && sceneChanged;
    setGame(next);
    persist(next);
    if (sceneChanged) {
      if (autoRead && next.sceneId) playScene(next.sceneId);
      else stopAudio();
    }
  }

  function act(action: PlayAction) {
    if (!game) return;
    const result = applyAction(ctx, game, action);
    if (!result.ok) {
      toast.error(result.reason);
      return;
    }
    show(result.state);
  }

  async function startGame(start: Extract<PlayAction, { t: "start" }>) {
    const withCarry = carry && Object.keys(carry).length > 0 ? { ...start, carry } : start;
    const memory = { visitedEndings: game?.visitedEndings ?? saved?.visitedEndings ?? [], achievements: game?.achievements ?? saved?.achievements ?? [] };
    setBusy(true);
    try {
      // Com conta: a semente dos dados vem do servidor (o progresso não pode ser forjado).
      if (persistent && signedIn) {
        const result = await startReaderGameAction(story.work.id, withCarry);
        if (result.ok) {
          const { state } = replay(ctx, result.saved);
          setCreating(false);
          show(state, false, false);
          return;
        }
      }
      const result = newGame(ctx, { start: withCarry, ...memory });
      if (!result.ok) {
        toast.error(result.reason);
        return;
      }
      setCreating(false);
      show(result.state, false, false);
    } finally {
      setBusy(false);
    }
  }

  function beginNew() {
    stopAudio();
    window.scrollTo({ top: 0 });
    const needsCreation = ctx.on("character") && (ctx.system.character.fields.length > 0 || ctx.system.character.vocations.length > 0 || ctx.system.character.startingPoints > 0);
    if (needsCreation || ctx.system.hardcore) {
      setGame(null);
      setCreating(true);
      return;
    }
    void startGame({ t: "start" });
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

  const audioElement = (
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
  const endingsTotal = story.scenes.filter((scene) => scene.isEnding).length;
  const badges = computedBadges(story.badges, { interactive: isInteractive(story.choices), hasAudio });
  // Modo teste: pula para a cena com o estado escolhido (começa uma partida se não houver).
  function jump(action: Extract<PlayAction, { t: "debug" }>) {
    let base = game;
    if (!base) {
      const first = newGame(ctx, { start: { t: "start" } });
      if (!first.ok) {
        toast.error(first.reason);
        return;
      }
      base = first.state;
    }
    const result = applyAction(ctx, base, action);
    if (!result.ok) toast.error(result.reason);
    else {
      setCreating(false);
      setAnimateFrom(Number.POSITIVE_INFINITY);
      shouldScroll.current = true;
      setGame(result.state);
    }
  }
  const panel = TestPanel ? <TestPanel state={game} jump={jump} /> : null;

  if (!game) {
    return (
      <div className="mx-auto w-full max-w-2xl space-y-6 px-4 py-8">
        {audioElement}
        {panel}
        <div className="grid gap-6 sm:grid-cols-[12rem_minmax(0,1fr)]">
          <WorkCover url={work.coverUrl} focus={work.coverFocus} title={text(work.title)} className="mx-auto max-w-48 sm:max-w-none" />
          <div className="space-y-4">
            <div className="space-y-1">
              <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">{text(work.title)}</h1>
              {text(work.subtitle) && <p className="text-lg text-muted-foreground">{text(work.subtitle)}</p>}
            </div>
            {text(work.synopsis) && <p className="whitespace-pre-line text-muted-foreground">{text(work.synopsis)}</p>}
            <WorkTagGroups groups={work.tags} badges={badges} locale={locale} fallbackLocale={work.defaultLocale} />
            <LocalePicker locales={work.locales} value={locale} onChange={changeLocale} />
            {hasAudio && (
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input type="checkbox" checked={autoRead} onChange={(event) => setAutoRead(event.target.checked)} className="size-4 rounded-sm border-border" />
                Ler em voz alta enquanto avanço
              </label>
            )}
            {!creating && (
              <div className="flex flex-wrap gap-2">
                {hydrated && saved?.started ? (
                  <>
                    <Button
                      onClick={() => {
                        setAnimateFrom(Number.POSITIVE_INFINITY);
                        setGame(saved);
                      }}
                    >
                      Continuar
                    </Button>
                    <Button variant="outline" disabled={busy} onClick={beginNew}>
                      Começar de novo
                    </Button>
                  </>
                ) : (
                  <Button disabled={!hydrated || busy} onClick={beginNew}>
                    Começar a ler
                  </Button>
                )}
              </div>
            )}
            {saved && saved.visitedEndings.length > 0 && (
              <p className="text-sm text-muted-foreground">
                Finais descobertos: {saved.visitedEndings.length} de {endingsTotal}
              </p>
            )}
            {persistent && !signedIn && <p className="text-xs text-muted-foreground">Seu progresso fica salvo neste navegador. Entre na sua conta para levar para outros aparelhos e ter salvamentos.</p>}
          </div>
        </div>
        {creating && <CharacterCreation ctx={ctx} text={text} busy={busy} onStart={(start) => void startGame(start)} />}
      </div>
    );
  }

  const step = nextStep(ctx, game);
  const sheet = buildSheet(ctx, game);
  const canUndo = !game.hardcore && game.log.some((action, index) => index > 0 && action.t === "choose");
  const lastAction = game.log[game.log.length - 1];
  const canReroll = ctx.on("dice") && ctx.system.dice.reroll.enabled && !game.hardcore && Boolean(game.rerollBase) && (lastAction?.t === "choose" || lastAction?.t === "reroll");
  const rerollCost = ctx.system.dice.reroll.cost
    .map((cost) => {
      const resource = ctx.resources.get(cost.resource);
      return resource ? `${formatNumber(evaluateNumber(cost.amount, playerScope(ctx, game), 0))} ${text(resource.abbr) || text(resource.name)}` : "";
    })
    .filter(Boolean)
    .join(", ");
  const chapterTitle = (chapterId: string) => {
    const ordered = [...story.chapters].sort((a, b) => a.position - b.position);
    const number = ordered.findIndex((candidate) => candidate.id === chapterId) + 1;
    const chapter = ordered[number - 1];
    return chapter ? `${number}. ${text(chapter.title)}` : "";
  };
  const alert = Boolean(sheet.level && sheet.level.points > 0) || game.overflow.length > 0;
  let rollIndex = 0;

  return (
    <div className={sheet.hasHud || sheet.hasPanel ? "mx-auto w-full max-w-2xl pb-44" : "mx-auto w-full max-w-2xl pb-24"}>
      {audioElement}
      <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-2">
        <p className="min-w-0 truncate text-sm font-medium text-foreground">
          {text(work.title)}
          {game.hardcore && <span className="ms-2 rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive">hardcore</span>}
        </p>
        <div className="flex shrink-0 items-center gap-1">
          <LocalePicker locales={work.locales} value={locale} onChange={changeLocale} compact />
          {hasAudio && (
            <Button
              size="icon"
              variant={autoRead ? "secondary" : "ghost"}
              aria-label={autoRead ? "Parar a leitura em voz alta" : "Ler em voz alta"}
              aria-pressed={autoRead}
              onClick={() => {
                const next = !autoRead;
                setAutoRead(next);
                if (next) playScene(game.sceneId);
                else stopAudio();
              }}
            >
              {autoRead ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
            </Button>
          )}
          <Button size="icon" variant="ghost" aria-label="Histórico da partida" onClick={() => setHistoryOpen(true)}>
            <History className="size-4" />
          </Button>
          {persistent && signedIn && (
            <Button size="icon" variant="ghost" aria-label="Salvamentos" onClick={() => setSavesOpen(true)}>
              <Save className="size-4" />
            </Button>
          )}
          {!game.hardcore && (
            <Button
              size="icon"
              variant="ghost"
              aria-label="Voltar para a última escolha"
              disabled={!canUndo}
              onClick={() => {
                const previous = undo(ctx, game);
                if (previous) show(previous, true, false);
              }}
            >
              <Undo2 className="size-4" />
            </Button>
          )}
          <Button
            size="icon"
            variant="ghost"
            aria-label="Recomeçar"
            onClick={() => {
              if (window.confirm("Recomeçar a história do início? Os finais e conquistas descobertos continuam.")) beginNew();
            }}
          >
            <RotateCcw className="size-4" />
          </Button>
        </div>
      </header>
      {panel && <div className="px-4 pt-4">{panel}</div>}
      <SheetDialog sheet={sheet} text={text} title={text(work.title)} open={sheetOpen} onOpenChange={setSheetOpen} act={act} canAct={!game.combat || Boolean(game.combat.result)} />
      <HistoryDialog ctx={ctx} state={game} text={text} locale={locale} open={historyOpen} onOpenChange={setHistoryOpen} />
      {persistent && signedIn && (
        <SavesDialog
          workId={work.id}
          state={game}
          text={text}
          open={savesOpen}
          onOpenChange={setSavesOpen}
          onLoad={(loaded) => {
            const { state } = replay(ctx, loaded);
            show(state, false, false);
            window.scrollTo({ top: 0 });
          }}
        />
      )}
      <GameHud sheet={sheet} text={text} onOpen={() => setSheetOpen(true)} alert={alert} />

      {game.entries.map((entry, position) => {
        const scene = ctx.scenes.get(entry.sceneId);
        if (!scene) return null;
        const previous = position > 0 ? ctx.scenes.get(game.entries[position - 1].sceneId) : undefined;
        const isLast = position === game.entries.length - 1;
        return (
          <Fragment key={`${entry.sceneId}-${position}`}>
            {(!previous || previous.chapterId !== scene.chapterId) && (
              <h2 className="px-4 pb-2 pt-10 text-center text-sm font-semibold uppercase tracking-caps text-muted-foreground">{chapterTitle(scene.chapterId)}</h2>
            )}
            <article ref={isLast ? lastSceneRef : undefined} className="scroll-mt-24 space-y-5 pb-8">
              {entry.rolls.map((roll, index) => {
                const globalIndex = rollIndex++;
                return <DiceRoll key={`${position}-${index}-${game.log.length}`} roll={roll} animate={globalIndex >= animateFrom} text={text} />;
              })}
              {audioFor(scene.id) && (
                <div className="px-4">
                  <Button size="sm" variant="outline" aria-pressed={playingSceneId === scene.id} onClick={() => (playingSceneId === scene.id ? stopAudio() : playScene(scene.id))}>
                    {playingSceneId === scene.id ? <Pause className="size-4" /> : <Play className="size-4" />}
                    {playingSceneId === scene.id ? "Pausar" : "Ouvir"}
                  </Button>
                </div>
              )}
              <SceneBlocksView
                blocks={interpolateBlocks(scene.blocks, profileFields, game.profile)}
                locale={locale}
                fallbackLocale={work.defaultLocale}
                media={story.media}
                cast={story.cast}
                eager={position < 2}
              />
              <CombatLog lines={entry.combat} text={text} />
              <ChangeChips changes={entry.changes} text={text} />
            </article>
          </Fragment>
        );
      })}

      <section className="space-y-3 px-4">
        {canReroll && (
          <Button variant="outline" size="sm" disabled={busy} onClick={() => act({ t: "reroll" })}>
            <Dices className="size-4" />
            Rolar de novo{rerollCost ? ` (custa ${rerollCost})` : ""}
          </Button>
        )}

        {step.kind === "overflow" && <OverflowPanel ctx={ctx} stacks={step.stacks} text={text} act={act} openBag={() => setSheetOpen(true)} busy={busy} />}

        {step.kind === "combat" && <CombatPanel ctx={ctx} state={game} mode={step.mode} text={text} act={act} busy={busy} />}

        {(step.kind === "choices" || step.kind === "dead-end") && step.shop && <ShopPanel ctx={ctx} state={game} shop={step.shop} text={text} act={act} busy={busy} />}

        {step.kind === "choices" &&
          step.choices.map((view) => (
            <ChoiceButton key={view.choice.id} view={view} text={text} dcLabel={(dc) => dcText(ctx.system.dice, dc, text)} profile={{ fields: profileFields, values: game.profile }} onChoose={() => act({ t: "choose", choiceId: view.choice.id })} />
          ))}

        {step.kind === "next-chapter" && (
          <Button className="w-full" onClick={() => act({ t: "continue" })}>
            Próximo capítulo: {chapterTitle(step.chapterId)}
          </Button>
        )}

        {step.kind === "ending" && (
          <div className="space-y-3 rounded-lg border border-border bg-card p-4 text-center">
            <p className="text-xs uppercase tracking-caps text-muted-foreground">Fim</p>
            {text(step.scene.endingTitle) && <p className="text-xl font-semibold text-foreground">{text(step.scene.endingTitle)}</p>}
            <p className="text-sm text-muted-foreground">
              Finais descobertos: {game.visitedEndings.length} de {endingsTotal}
              {ctx.achievements.size > 0 && ` · Conquistas: ${game.achievements.length} de ${ctx.achievements.size}`}
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {canUndo && (
                <Button
                  variant="outline"
                  onClick={() => {
                    const previous = undo(ctx, game);
                    if (previous) show(previous, true, false);
                  }}
                >
                  Voltar para a última escolha
                </Button>
              )}
              <Button onClick={beginNew}>Jogar de novo</Button>
            </div>
          </div>
        )}

        {step.kind === "dead-end" && !step.shop && (
          <div className="space-y-3 rounded-lg border border-border bg-card p-4 text-center">
            <p className="text-sm text-muted-foreground">A história continua em breve.</p>
            {canUndo && (
              <Button
                variant="outline"
                onClick={() => {
                  const previous = undo(ctx, game);
                  if (previous) show(previous, true, false);
                }}
              >
                Voltar para a última escolha
              </Button>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function dcText(dice: Story["system"]["dice"], dc: number | null, text: (value: LocalizedText) => string): string {
  if (dc === null || dice.showDc === "hidden") return "";
  if (dice.showDc === "number") return `DT ${formatNumber(dc)}`;
  const word = [...dice.words].sort((a, b) => a.upTo - b.upTo).find((entry) => dc <= entry.upTo) ?? dice.words.at(-1);
  return word ? text(word.label) : `DT ${formatNumber(dc)}`;
}

function ChoiceButton({
  view,
  text,
  dcLabel,
  profile,
  onChoose,
}: {
  view: ChoiceView;
  text: (value: LocalizedText) => string;
  dcLabel: (dc: number | null) => string;
  profile: { fields: Story["system"]["character"]["fields"]; values: Record<string, string> };
  onChoose: () => void;
}) {
  const label = text(interpolateText(view.choice.label, profile.fields, profile.values));
  const test = view.test ? [text(view.test.label), dcLabel(view.test.dc)].filter(Boolean).join(", ") : "";
  return (
    <Button variant="outline" className="h-auto w-full flex-col items-start gap-1 whitespace-normal py-3 text-left" disabled={!view.enabled} onClick={onChoose}>
      <span className="flex w-full flex-wrap items-baseline justify-between gap-2">
        <span>{label}</span>
        <span className="flex flex-wrap gap-1">
          {view.costs.map((cost) => (
            <span key={cost.resource.key} className={cn("rounded-full px-2 py-0.5 text-xs font-medium", ACCENT_CLASSES[cost.resource.color].soft, ACCENT_CLASSES[cost.resource.color].text)}>
              {formatNumber(cost.amount)} {text(cost.resource.abbr) || text(cost.resource.name)}
            </span>
          ))}
        </span>
      </span>
      {test && (
        <span className="flex items-center gap-1 text-xs font-normal text-muted-foreground">
          <Dices className="size-3.5" aria-hidden />
          {test}
        </span>
      )}
      {!view.enabled && view.reason && <span className="text-xs font-normal text-destructive">{view.reason}</span>}
    </Button>
  );
}

function LocalePicker({ locales, value, onChange, compact = false }: { locales: string[]; value: string; onChange: (locale: string) => void; compact?: boolean }) {
  if (locales.length <= 1) return null;
  return (
    <select
      aria-label="Idioma"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={compact ? "h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground" : "h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground"}
    >
      {locales.map((locale) => (
        <option key={locale} value={locale}>
          {localeLabel(locale)}
        </option>
      ))}
    </select>
  );
}
