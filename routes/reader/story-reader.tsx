"use client";

import { Fragment, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ComponentType } from "react";
import { Dices, History, Pause, Play, RotateCcw, Undo2, Volume2, VolumeX } from "lucide-react";
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
import type { GameState, PlayAction, RollView, SavedGame } from "../../shared/engine/types";
import { localeLabel } from "../../shared/locales";
import { pickText } from "../../shared/localized-text";
import type { ReaderStats } from "../../shared/reader-stats";
import { computedBadges } from "../../shared/tag-catalog";
import { getReaderStatsAction, saveReaderProgressAction, startReaderGameAction } from "./actions";
import { CharacterCreation } from "./character-creation";
import { DiceRoll, DiceThrow } from "./dice-roll";
import { ChangeChips, CombatLog, formatNumber, GameHud, SheetDialog } from "./game-hud";
import { CombatPanel, HistoryDialog, LevelUpDialog, OverflowPanel, ReaderAchievementsPanel, ShopPanel } from "./game-panels";
import { readerStrings, type ReaderStrings } from "./strings";

type ServerProgress = { state: SavedGame | ReaderState; updatedAt: string };

const LOCALE_KEY = "novels:locale";
const AUTO_READ_KEY = "novels:auto-read";

// localStorage só guarda preferências (idioma, leitura em voz alta). A jornada é salva só na conta.
function writeLocal(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // sem armazenamento local: só perde a preferência
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

function allRolls(state: GameState | null): RollView[] {
  return state ? state.entries.flatMap((entry) => entry.rolls) : [];
}

// Leitor (0.14.0): a jornada é salva só para quem tem conta, depois de cada escolha, e só anda para
// a frente — para seguir outro caminho, o leitor começa uma nova jornada. O modo teste do autor
// não salva e pode voltar.
export function StoryReader({
  story,
  signedIn,
  serverProgress,
  carry,
  stats: initialStats = null,
  mode = "public",
  TestPanel,
}: {
  story: Story;
  signedIn: boolean;
  serverProgress: ServerProgress | null;
  // Valores herdados da obra anterior da série (servidor já calculou).
  carry?: Record<string, VariableValue>;
  // Desempenho do leitor com conta (jornadas, explorado, conquistas).
  stats?: ReaderStats | null;
  // "test": modo teste do autor (rascunho, sem salvar, aceita pular para cena e voltar).
  mode?: "public" | "test";
  TestPanel?: ComponentType<{ state: GameState | null; jump: (action: Extract<PlayAction, { t: "debug" }>) => void }>;
}) {
  const ctx = useMemo(() => createContext(story, { debug: mode === "test" }), [story, mode]);
  const testing = mode === "test";
  const persistent = !testing && signedIn;
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const storedLocale = useSyncExternalStore(subscribeStorage, () => readRaw(LOCALE_KEY), () => null);
  const storedAutoRead = useSyncExternalStore(subscribeStorage, () => readRaw(AUTO_READ_KEY), () => null);
  const [chosenLocale, setChosenLocale] = useState<string | null>(null);
  const [chosenAutoRead, setChosenAutoRead] = useState<boolean | null>(null);
  const [game, setGame] = useState<GameState | null>(null);
  const [stats, setStats] = useState<ReaderStats | null>(initialStats);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [throwing, setThrowing] = useState<{ roll: RollView; key: number } | null>(null);
  const [levelUp, setLevelUp] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioSceneRef = useRef<string | null>(null);
  const [playingSceneId, setPlayingSceneId] = useState<string | null>(null);
  const lastSceneRef = useRef<HTMLElement | null>(null);
  const shouldScroll = useRef(false);
  // Salvamentos em fila: um de cada vez, na ordem das escolhas.
  const saveQueue = useRef<Promise<void>>(Promise.resolve());

  const savedLocale = parse<string>(storedLocale);
  const locale = chosenLocale ?? (savedLocale && story.work.locales.includes(savedLocale) ? savedLocale : story.work.defaultLocale);
  const strings: ReaderStrings = readerStrings(locale);
  const autoRead = chosenAutoRead ?? parse<boolean>(storedAutoRead) === true;
  const audioFor = (sceneId: string) => story.audio[sceneId]?.[locale] ?? null;
  const hasAudio = story.scenes.some((scene) => audioFor(scene.id));
  const text = (value: LocalizedText | undefined) => pickText(value ?? {}, locale, story.work.defaultLocale);
  const profileFields = ctx.on("character") ? ctx.system.character.fields : [];

  // Jornada salva na conta, refeita pelo motor.
  const saved = useMemo<GameState | null>(() => {
    if (!persistent || !serverProgress) return null;
    if (isSavedGame(serverProgress.state)) return replay(ctx, serverProgress.state).state;
    return fromLegacy(ctx, serverProgress.state);
  }, [persistent, serverProgress, ctx]);

  useEffect(() => {
    if (shouldScroll.current && lastSceneRef.current) {
      lastSceneRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      shouldScroll.current = false;
    }
  }, [game]);

  function persist(next: GameState) {
    if (!persistent) return;
    const savedGame = toSaved(next);
    const finished = Boolean(ctx.scenes.get(next.sceneId)?.isEnding);
    saveQueue.current = saveQueue.current.then(async () => {
      const result = await saveReaderProgressAction(story.work.id, savedGame);
      if (!result.ok && (result.error === "novels.seed_mismatch" || result.error === "novels.no_going_back")) {
        toast.error(result.error === "novels.no_going_back" ? strings.noGoingBack : "Esta jornada não é a que está salva na sua conta. Recarregue a página.");
      }
      if (result.ok && finished) setStats(await getReaderStatsAction(story.work.id));
    });
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

  function show(next: GameState, options: { scroll?: boolean; save?: boolean; animate?: boolean } = {}) {
    const { scroll = true, save = true, animate = true } = options;
    const sceneChanged = next.sceneId !== game?.sceneId || next.path.length !== game?.path.length;
    const before = allRolls(game).length;
    const after = allRolls(next);
    if (animate && after.length > before) setThrowing({ roll: after[after.length - 1], key: after.length });
    const changes = next.entries[next.entries.length - 1]?.changes ?? [];
    const level = changes.find((change) => change.type === "level");
    if (animate && level && level.type === "level" && text(ctx.system.progression.levelUpMessage)) setLevelUp(level.value);
    shouldScroll.current = scroll && sceneChanged;
    setGame(next);
    if (save) persist(next);
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
    setBusy(true);
    try {
      // Com conta: a semente dos dados vem do servidor (a jornada não pode ser forjada).
      if (persistent) {
        const result = await startReaderGameAction(story.work.id, withCarry);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        setCreating(false);
        show(replay(ctx, result.saved).state, { scroll: false, save: false, animate: false });
        return;
      }
      const memory = { visitedEndings: game?.visitedEndings ?? [], achievements: game?.achievements ?? [] };
      const result = newGame(ctx, { start: withCarry, ...memory });
      if (!result.ok) {
        toast.error(result.reason);
        return;
      }
      setCreating(false);
      show(result.state, { scroll: false, save: false, animate: false });
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
      show(result.state, { save: false, animate: false });
    }
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
  const panel = TestPanel ? <TestPanel state={game} jump={jump} /> : null;
  const achievementsPanel = persistent && stats ? <ReaderAchievementsPanel ctx={ctx} stats={stats} text={text} strings={strings} /> : null;

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
                {strings.readAloud}
              </label>
            )}
            {!creating && (
              <div className="flex flex-wrap gap-2">
                {hydrated && saved?.started ? (
                  <>
                    <Button
                      onClick={() => {
                        setGame(saved);
                      }}
                    >
                      {strings.continue}
                    </Button>
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() => {
                        if (window.confirm(strings.newJourneyConfirm)) beginNew();
                      }}
                    >
                      {strings.newJourney}
                    </Button>
                  </>
                ) : (
                  <Button disabled={!hydrated || busy} onClick={beginNew}>
                    {strings.start}
                  </Button>
                )}
              </div>
            )}
            {!testing && <p className="text-xs text-muted-foreground">{persistent ? strings.noGoingBack : strings.signInToSave}</p>}
          </div>
        </div>
        {achievementsPanel}
        {creating && <CharacterCreation ctx={ctx} text={text} strings={strings} media={story.media} busy={busy} onStart={(start) => void startGame(start)} />}
      </div>
    );
  }

  const step = nextStep(ctx, game);
  const sheet = buildSheet(ctx, game);
  // Voltar só no modo teste do autor: o leitor segue em frente ou começa uma nova jornada.
  const canUndo = testing && game.log.some((action, index) => index > 0 && action.t === "choose");
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
  const goBack = () => {
    const previous = undo(ctx, game);
    if (previous) show(previous, { save: false, animate: false });
  };

  return (
    <div className={sheet.hasHud || sheet.hasPanel ? "mx-auto w-full max-w-2xl pb-44" : "mx-auto w-full max-w-2xl pb-24"}>
      {audioElement}
      {throwing && <DiceThrow key={throwing.key} roll={throwing.roll} text={text} strings={strings} onDone={() => setThrowing(null)} />}
      {levelUp !== null && (
        <LevelUpDialog
          level={levelUp}
          message={ctx.system.progression.levelUpMessage}
          text={text}
          strings={strings}
          onClose={() => setLevelUp(null)}
          onDistribute={
            sheet.level && sheet.level.points > 0
              ? () => {
                  setLevelUp(null);
                  setSheetOpen(true);
                }
              : null
          }
        />
      )}
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
              aria-label={strings.readAloud}
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
          <Button size="icon" variant="ghost" aria-label={strings.history} onClick={() => setHistoryOpen(true)}>
            <History className="size-4" />
          </Button>
          {canUndo && (
            <Button size="icon" variant="ghost" aria-label={strings.undo} onClick={goBack}>
              <Undo2 className="size-4" />
            </Button>
          )}
          <Button
            size="icon"
            variant="ghost"
            aria-label={strings.newJourney}
            onClick={() => {
              if (window.confirm(strings.newJourneyConfirm)) beginNew();
            }}
          >
            <RotateCcw className="size-4" />
          </Button>
        </div>
      </header>
      {!persistent && !testing && <p className="border-b border-border bg-muted/40 px-4 py-2 text-xs text-muted-foreground">{strings.signInToSave}</p>}
      {panel && <div className="px-4 pt-4">{panel}</div>}
      <SheetDialog sheet={sheet} text={text} title={text(work.title)} open={sheetOpen} onOpenChange={setSheetOpen} act={act} canAct={!game.combat || Boolean(game.combat.result) || ctx.system.combat.equipInCombat} media={story.media} strings={strings} />
      <HistoryDialog ctx={ctx} state={game} text={text} locale={locale} open={historyOpen} onOpenChange={setHistoryOpen} strings={strings} />
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
            <article ref={isLast ? lastSceneRef : undefined} className={cn("scroll-mt-24 space-y-5 pb-8", isLast && throwing && "invisible")}>
              {entry.rolls.map((roll, index) => (
                <DiceRoll key={`${position}-${index}`} roll={roll} text={text} strings={strings} />
              ))}
              {audioFor(scene.id) && (
                <div className="px-4">
                  <Button size="sm" variant="outline" aria-pressed={playingSceneId === scene.id} onClick={() => (playingSceneId === scene.id ? stopAudio() : playScene(scene.id))}>
                    {playingSceneId === scene.id ? <Pause className="size-4" /> : <Play className="size-4" />}
                    {playingSceneId === scene.id ? strings.pause : strings.listen}
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
              <CombatLog lines={entry.combat} text={text} messages={scene.mechanics.encounter?.messages} />
              <ChangeChips changes={entry.changes} text={text} />
            </article>
          </Fragment>
        );
      })}

      <section className="space-y-3 px-4">
        {canReroll && (
          <Button variant="outline" size="sm" disabled={busy} onClick={() => act({ t: "reroll" })}>
            <Dices className="size-4" />
            {strings.reroll}
            {rerollCost ? ` (${strings.costs} ${rerollCost})` : ""}
          </Button>
        )}

        {step.kind === "overflow" && <OverflowPanel ctx={ctx} stacks={step.stacks} text={text} act={act} openBag={() => setSheetOpen(true)} busy={busy} strings={strings} />}

        {step.kind === "combat" && <CombatPanel ctx={ctx} state={game} mode={step.mode} text={text} act={act} busy={busy} strings={strings} />}

        {(step.kind === "choices" || step.kind === "dead-end") && step.shop && <ShopPanel ctx={ctx} state={game} shop={step.shop} text={text} act={act} busy={busy} strings={strings} />}

        {step.kind === "choices" &&
          step.choices.map((view) => (
            <ChoiceButton key={view.choice.id} view={view} text={text} dcLabel={(dc) => dcText(ctx.system.dice, dc, text)} profile={{ fields: profileFields, values: game.profile }} onChoose={() => act({ t: "choose", choiceId: view.choice.id })} />
          ))}

        {step.kind === "next-chapter" && (
          <Button className="w-full" onClick={() => act({ t: "continue" })}>
            {strings.nextChapter}: {chapterTitle(step.chapterId)}
          </Button>
        )}

        {step.kind === "ending" && (
          <div className="space-y-3 rounded-lg border border-border bg-card p-4 text-center">
            <p className="text-xs uppercase tracking-caps text-muted-foreground">{strings.theEnd}</p>
            {text(step.scene.endingTitle) && <p className="text-xl font-semibold text-foreground">{text(step.scene.endingTitle)}</p>}
            <p className="text-sm text-muted-foreground">
              {strings.endingsFound}: {Math.max(game.visitedEndings.length, stats?.endingsSeen.length ?? 0)} / {endingsTotal}
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {canUndo && (
                <Button variant="outline" onClick={goBack}>
                  {strings.undo}
                </Button>
              )}
              <Button onClick={beginNew}>{strings.playAgain}</Button>
            </div>
          </div>
        )}
        {step.kind === "ending" && achievementsPanel}

        {step.kind === "dead-end" && !step.shop && (
          <div className="space-y-3 rounded-lg border border-border bg-card p-4 text-center">
            <p className="text-sm text-muted-foreground">{strings.comingSoon}</p>
            {canUndo && (
              <Button variant="outline" onClick={goBack}>
                {strings.undo}
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
