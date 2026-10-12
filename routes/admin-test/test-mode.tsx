"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronDown, FlaskConical, Play } from "lucide-react";
import { Button, Input, cn } from "@venore/plugin-sdk/ui";
import type { Story, VariableValue } from "../../contracts/types";
import { adminWorkPath } from "../../shared/constants";
import { createContext } from "../../shared/engine/context";
import { num } from "../../shared/engine/formula";
import { currentLevel } from "../../shared/engine/rules";
import { saveCoverage } from "../../components/sim-coverage";
import { compareBuilds, SIM_STRATEGIES, simulateRunsInChunks, type BuildPoint, type RunSummary, type SimStrategy } from "../../shared/engine/simulate";
import type { GameState, PlayAction, Stack } from "../../shared/engine/types";
import { pickText } from "../../shared/localized-text";
import { StoryReader } from "../reader/story-reader";

const SELECT = "h-9 min-w-0 rounded-md border border-border bg-background px-2 text-sm text-foreground";

// Modo teste do autor (seção 13): a obra como está no editor, jogável a partir de qualquer cena
// com o estado escolhido (nível, recursos, itens). Nada é salvo. Logo abaixo, o simulador.
export function TestMode({ story, initialSceneId }: { story: Story; initialSceneId: string | null }) {
  const locale = story.work.defaultLocale;
  const text = (value: Record<string, string> | undefined) => pickText(value ?? {}, locale, locale);
  const Panel = useMemo(
    () =>
      function Panel({ state, jump }: { state: GameState | null; jump: (action: Extract<PlayAction, { t: "debug" }>) => void }) {
        return <JumpPanel story={story} state={state} jump={jump} initialSceneId={initialSceneId} />;
      },
    [story, initialSceneId],
  );
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4 sm:px-0">
        <Link href={adminWorkPath(story.work.id)} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" />
          {text(story.work.title)}
        </Link>
        <span className="inline-flex items-center gap-1 rounded-full bg-warning-soft px-2.5 py-0.5 text-xs font-medium text-warning">
          <FlaskConical className="size-3.5" aria-hidden />
          Modo teste: rascunho, nada é salvo
        </span>
      </div>
      <StoryReader
        story={story}
        signedIn={false}
        serverProgress={null}
        mode="test"
        TestPanel={Panel}
      />
      <Simulator story={story} />
    </div>
  );
}

function JumpPanel({
  story,
  state,
  jump,
  initialSceneId,
}: {
  story: Story;
  state: GameState | null;
  jump: (action: Extract<PlayAction, { t: "debug" }>) => void;
  initialSceneId: string | null;
}) {
  const ctx = useMemo(() => createContext(story), [story]);
  const locale = story.work.defaultLocale;
  const text = (value: Record<string, string> | undefined) => pickText(value ?? {}, locale, locale);
  const [open, setOpen] = useState(true);
  const [sceneId, setSceneId] = useState(initialSceneId ?? story.chapters.find((chapter) => chapter.startSceneId)?.startSceneId ?? story.scenes[0]?.id ?? "");
  const [level, setLevel] = useState(state ? currentLevel(ctx, state) : 1);
  const [vars, setVars] = useState<Record<string, VariableValue>>({});
  const [items, setItems] = useState<Stack[]>([]);
  const [itemId, setItemId] = useState(story.items[0]?.id ?? "");

  const numbers = [
    ...[...ctx.resources.values()].map((resource) => ({ key: resource.key, label: text(resource.name) })),
    ...[...ctx.attributes.values()].map((attribute) => ({ key: attribute.key, label: text(attribute.name) })),
    ...story.work.variables.map((variable) => ({ key: variable.key, label: variable.label || variable.key, boolean: variable.type === "boolean" })),
  ];
  const chapters = [...story.chapters].sort((a, b) => a.position - b.position);

  return (
    <section className="space-y-3 rounded-xl border border-warning-border bg-card p-3">
      <button type="button" className="flex w-full items-center justify-between text-sm font-semibold text-foreground" aria-expanded={open} onClick={() => setOpen(!open)}>
        Testar daqui
        <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open && (
        <>
          <label className="block space-y-1 text-sm">
            <span className="text-muted-foreground">Cena</span>
            <select className={cn(SELECT, "w-full")} value={sceneId} onChange={(event) => setSceneId(event.target.value)}>
              {chapters.map((chapter, index) => (
                <optgroup key={chapter.id} label={`${index + 1}. ${text(chapter.title)}`}>
                  {story.scenes
                    .filter((scene) => scene.chapterId === chapter.id)
                    .map((scene) => (
                      <option key={scene.id} value={scene.id}>
                        {scene.label || "Cena sem nome"}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {ctx.on("progression") && (
              <label className="space-y-1 text-xs text-muted-foreground">
                {text(ctx.system.progression.levelName)}
                <Input type="number" min={1} value={String(level)} onChange={(event) => setLevel(Math.max(1, Math.trunc(Number(event.target.value) || 1)))} />
              </label>
            )}
            {numbers.map((entry) => (
              <label key={entry.key} className="space-y-1 text-xs text-muted-foreground">
                {entry.label}
                {"boolean" in entry && entry.boolean ? (
                  <select className={cn(SELECT, "w-full")} value={vars[entry.key] === undefined ? "" : String(vars[entry.key])} onChange={(event) => setVars({ ...vars, [entry.key]: event.target.value === "true" })}>
                    <option value="">como está</option>
                    <option value="true">sim</option>
                    <option value="false">não</option>
                  </select>
                ) : (
                  <Input
                    type="number"
                    placeholder={state ? String(num(state.vars[entry.key])) : "como está"}
                    value={vars[entry.key] === undefined ? "" : String(vars[entry.key])}
                    onChange={(event) => {
                      const next = { ...vars };
                      if (event.target.value === "") delete next[entry.key];
                      else next[entry.key] = Number(event.target.value) || 0;
                      setVars(next);
                    }}
                  />
                )}
              </label>
            ))}
          </div>
          {story.items.length > 0 && (
            <div className="space-y-1 text-sm">
              <div className="flex flex-wrap items-center gap-1">
                <select className={SELECT} value={itemId} onChange={(event) => setItemId(event.target.value)} aria-label="Item para dar">
                  {story.items.map((item) => (
                    <option key={item.id} value={item.id}>
                      {text(item.name)}
                    </option>
                  ))}
                </select>
                <Button type="button" size="sm" variant="outline" onClick={() => setItems([...items, { itemId, quantity: 1 }])}>
                  Dar item
                </Button>
              </div>
              {items.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Vai receber: {items.map((stack) => text(story.items.find((item) => item.id === stack.itemId)?.name)).join(", ")}{" "}
                  <button type="button" className="text-primary hover:underline" onClick={() => setItems([])}>
                    limpar
                  </button>
                </p>
              )}
            </div>
          )}
          <Button
            type="button"
            className="w-full"
            onClick={() => {
              jump({ t: "debug", sceneId, vars, items, level: ctx.on("progression") ? level : undefined });
              setItems([]);
            }}
          >
            <Play className="size-4" />
            Ir para a cena com este estado
          </Button>
        </>
      )}
    </section>
  );
}

const STRATEGY_LABELS: Record<SimStrategy, string> = {
  random: "Aleatória",
  explorer: "Explorador (prefere cena nova)",
  cautious: "Cauteloso (evita teste, foge)",
  aggressive: "Agressivo (só ataca)",
};

function Simulator({ story }: { story: Story }) {
  const ctx = useMemo(() => createContext(story), [story]);
  const locale = story.work.defaultLocale;
  const text = (value: Record<string, string> | undefined) => pickText(value ?? {}, locale, locale);
  const [runs, setRuns] = useState(300);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(0);
  const [strategy, setStrategy] = useState<SimStrategy>("random");
  const [summary, setSummary] = useState<RunSummary | null>(null);
  const [builds, setBuilds] = useState<BuildPoint[] | null>(null);
  const label = (sceneId: string) => story.scenes.find((scene) => scene.id === sceneId)?.label || "cena";
  const percent = (count: number) => `${Math.round((count / Math.max(1, summary?.runs ?? 1)) * 100)}%`;
  const unreached = summary ? story.scenes.filter((scene) => !summary.visited.has(scene.id)) : [];
  const maxDamage = builds ? Math.max(1, ...builds.flatMap((point) => [point.pure, point.balanced])) : 1;

  return (
    <section className="mx-auto w-full max-w-2xl space-y-4 rounded-xl border border-border bg-card p-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-foreground">Simulador de balanceamento</h2>
        <p className="text-sm text-muted-foreground">Partidas automáticas (o mesmo motor do leitor): % de cada final, cenas nunca alcançadas, onde os recursos zeram e onde a partida empaca.</p>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="space-y-1 text-xs text-muted-foreground">
          Partidas
          <Input type="number" min={10} max={3000} className="w-28" value={String(runs)} onChange={(event) => setRuns(Math.max(10, Math.min(3000, Math.trunc(Number(event.target.value) || 10))))} />
        </label>
        <label className="space-y-1 text-xs text-muted-foreground">
          Estratégia
          <select className="block h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground" value={strategy} onChange={(event) => setStrategy(event.target.value as SimStrategy)}>
            {SIM_STRATEGIES.map((option) => (
              <option key={option} value={option}>
                {STRATEGY_LABELS[option]}
              </option>
            ))}
          </select>
        </label>
        <Button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setDone(0);
            const result = await simulateRunsInChunks(ctx, runs, { seedPrefix: `sim-${Date.now()}`, strategy, onProgress: setDone });
            setSummary(result);
            saveCoverage(story.work.id, Object.fromEntries(story.scenes.map((scene) => [scene.id, Math.round(((result.visited.get(scene.id) ?? 0) / Math.max(1, result.runs)) * 100)])));
            setBusy(false);
          }}
        >
          {busy ? `Simulando... ${Math.round((done / runs) * 100)}%` : "Simular"}
        </Button>
        {ctx.on("combat") && ctx.creatures.size > 0 && ctx.system.combat.actions.length > 0 && (
          <Button variant="outline" disabled={busy} onClick={() => setBuilds(compareBuilds(ctx, 10))}>
            Build pura × equilibrada
          </Button>
        )}
      </div>
      {summary && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1 text-sm">
            <p className="font-medium text-foreground">Finais ({summary.runs} partidas, {summary.averageSteps} passos em média)</p>
            {[...summary.endings.entries()]
              .sort((a, b) => b[1] - a[1])
              .map(([sceneId, count]) => (
                <p key={sceneId} className="flex justify-between gap-2">
                  <span className="truncate text-foreground">{text(story.scenes.find((scene) => scene.id === sceneId)?.endingTitle) || label(sceneId)}</span>
                  <span className="tabular-nums text-muted-foreground">{percent(count)}</span>
                </p>
              ))}
            {summary.endings.size === 0 && <p className="text-muted-foreground">Nenhuma partida chegou a um final.</p>}
          </div>
          <div className="space-y-1 text-sm">
            <p className="font-medium text-foreground">Onde os recursos zeraram</p>
            {[...summary.deaths.entries()].map(([sceneId, count]) => (
              <p key={sceneId} className="flex justify-between gap-2">
                <span className="truncate text-foreground">{label(sceneId)}</span>
                <span className="tabular-nums text-muted-foreground">{percent(count)}</span>
              </p>
            ))}
            {summary.deaths.size === 0 && <p className="text-muted-foreground">Em nenhuma.</p>}
          </div>
          <div className="space-y-1 text-sm">
            <p className="font-medium text-foreground">Partidas que empacaram (sem saída)</p>
            {[...summary.stuck.entries()].map(([sceneId, count]) => (
              <p key={sceneId} className="flex justify-between gap-2">
                <span className="truncate text-foreground">{label(sceneId)}</span>
                <span className="tabular-nums text-muted-foreground">{percent(count)}</span>
              </p>
            ))}
            {summary.stuck.size === 0 && <p className="text-muted-foreground">Nenhuma.</p>}
          </div>
          <div className="space-y-1 text-sm">
            <p className="font-medium text-foreground">
              Cenas nunca alcançadas ({Math.round((summary.visited.size / Math.max(1, story.scenes.length)) * 100)}% da obra visitada)
            </p>
            {unreached.length === 0 ? <p className="text-muted-foreground">Todas foram visitadas.</p> : <p className="text-foreground">{unreached.map((scene) => scene.label || "cena sem nome").join(", ")}</p>}
          </div>
        </div>
      )}
      {builds && (
        <div className="space-y-2 text-sm">
          <p className="font-medium text-foreground">Dano médio por rodada (primeira ação contra a primeira criatura)</p>
          <div className="flex gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <span className="size-2.5 rounded-sm bg-chart-2" aria-hidden /> pura (tudo no primeiro atributo)
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="size-2.5 rounded-sm bg-primary" aria-hidden /> equilibrada
            </span>
          </div>
          <ul className="space-y-1">
            {builds.map((point) => (
              <li key={point.level} className="grid grid-cols-[3rem_1fr] items-center gap-2">
                <span className="tabular-nums text-muted-foreground">nv {point.level}</span>
                <span className="space-y-0.5">
                  <span className="flex items-center gap-2">
                    <span className="h-2 rounded-sm bg-chart-2" style={{ width: `${(point.pure / maxDamage) * 100}%` }} />
                    <span className="text-xs tabular-nums text-muted-foreground">{point.pure}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="h-2 rounded-sm bg-primary" style={{ width: `${(point.balanced / maxDamage) * 100}%` }} />
                    <span className="text-xs tabular-nums text-muted-foreground">{point.balanced}</span>
                  </span>
                </span>
              </li>
            ))}
          </ul>
          {builds.length === 0 && <p className="text-muted-foreground">Cadastre uma ação de combate e uma criatura.</p>}
        </div>
      )}
    </section>
  );
}
