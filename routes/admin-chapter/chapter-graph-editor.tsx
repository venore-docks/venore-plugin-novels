"use client";

import "@xyflow/react/dist/style.css";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, useTransition, type CSSProperties } from "react";
import {
  Background,
  Controls,
  MarkerType,
  ReactFlow,
  ReactFlowProvider,
  type Connection,
  type Edge,
  type EdgeChange,
  type NodeChange,
} from "@xyflow/react";
import { ArrowLeft, Plus, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@venore/plugin-sdk/ui";
import type { ChapterGraph, ChapterGraphChoice, ChapterGraphScene } from "../../contracts/types";
import type { ChapterGraphEditorView } from "../../features/graph/get-chapter-graph/types";
import { adminWorkPath } from "../../shared/constants";
import { pickText } from "../../shared/localized-text";
import { validateStory, type StoryIssue } from "../../shared/story-validation";
import { saveChapterGraphAction } from "../admin/actions";
import { ChoiceInspector } from "./choice-inspector";
import { SceneInspector } from "./scene-inspector";
import { SceneNode, type SceneFlowNode } from "./scene-node";

type Selection = { kind: "scene"; id: string } | { kind: "choice"; id: string } | null;

const NODE_TYPES = { scene: SceneNode };

// Tokens do tema aplicados às variáveis do xyflow: o canvas segue claro/escuro do site sem cor
// crua (o CSS do xyflow lê var(--xy-*, <default>)).
const FLOW_THEME = {
  "--xy-background-color": "transparent",
  "--xy-background-pattern-dots-color": "var(--border)",
  "--xy-edge-stroke": "var(--muted-foreground)",
  "--xy-edge-stroke-selected": "var(--primary)",
  "--xy-edge-label-background-color": "var(--card)",
  "--xy-edge-label-color": "var(--foreground)",
  "--xy-connectionline-stroke": "var(--primary)",
  "--xy-handle-background-color": "var(--primary)",
  "--xy-handle-border-color": "var(--card)",
  "--xy-controls-button-background-color": "var(--card)",
  "--xy-controls-button-background-color-hover": "var(--muted)",
  "--xy-controls-button-color": "var(--foreground)",
  "--xy-controls-button-color-hover": "var(--foreground)",
  "--xy-controls-button-border-color": "var(--border)",
  "--xy-attribution-background-color": "transparent",
} as CSSProperties;

function newId(): string {
  return crypto.randomUUID();
}

export function ChapterGraphEditor({ view }: { view: ChapterGraphEditorView }) {
  return (
    <ReactFlowProvider>
      <Editor view={view} />
    </ReactFlowProvider>
  );
}

function Editor({ view }: { view: ChapterGraphEditorView }) {
  const { work, chapter } = view;
  const locale = work.defaultLocale;
  const [scenes, setScenes] = useState<ChapterGraphScene[]>(view.graph.scenes);
  const [choices, setChoices] = useState<ChapterGraphChoice[]>(view.graph.choices);
  const [startSceneId, setStartSceneId] = useState<string | null>(view.graph.startSceneId);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>(view.imageUrls);
  const [selection, setSelection] = useState<Selection>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, startSaving] = useTransition();

  // Validação ao vivo só deste capítulo. Um capítulo "fantasma" depois dele faz o validador
  // tratar este como não-último quando ele não é (cena sem escolha = fim de capítulo, não beco).
  const issues = useMemo<StoryIssue[]>(() => {
    const isLast = view.chapterNumber === view.chapterCount;
    const chapters = [{ id: chapter.id, position: 1, title: chapter.title, startSceneId }];
    if (!isLast) chapters.push({ id: "__next__", position: 2, title: {}, startSceneId: null });
    return validateStory({
      work: { title: work.title, defaultLocale: work.defaultLocale, locales: work.locales, variables: work.variables },
      chapters,
      scenes: scenes.map((scene) => ({ ...scene, chapterId: chapter.id })),
      choices,
    }).filter((issue) => issue.chapterId === chapter.id);
  }, [scenes, choices, startSceneId, chapter, work, view.chapterNumber, view.chapterCount]);

  const errorSceneIds = useMemo(
    () => new Set(issues.filter((issue) => issue.severity === "error" && issue.sceneId).map((issue) => issue.sceneId!)),
    [issues],
  );

  const nodes = useMemo<SceneFlowNode[]>(
    () =>
      scenes.map((scene) => ({
        id: scene.id,
        type: "scene",
        position: { x: scene.graphX, y: scene.graphY },
        selected: selection?.kind === "scene" && selection.id === scene.id,
        data: {
          label: scene.label,
          excerpt: pickText(scene.body, locale, locale).slice(0, 120),
          imageUrl: scene.imageMediaId ? (imageUrls[scene.imageMediaId] ?? null) : null,
          isStart: scene.id === startSceneId,
          isEnding: scene.isEnding,
          hasError: errorSceneIds.has(scene.id),
        },
      })),
    [scenes, selection, imageUrls, startSceneId, errorSceneIds, locale],
  );

  // Escolhas paralelas (mesma origem e destino) desenham setas sobrepostas: o rótulo vai todo na
  // primeira, juntando os textos, pra nenhum sumir atrás do outro.
  const edges = useMemo<Edge[]>(() => {
    const labelOf = (choice: ChapterGraphChoice) => pickText(choice.label, locale, locale) || "(sem texto)";
    const groups = new Map<string, ChapterGraphChoice[]>();
    for (const choice of choices) {
      const key = `${choice.sceneId}->${choice.targetSceneId}`;
      groups.set(key, [...(groups.get(key) ?? []), choice]);
    }
    return choices.map((choice) => {
      const group = groups.get(`${choice.sceneId}->${choice.targetSceneId}`) ?? [choice];
      return {
        id: choice.id,
        source: choice.sceneId,
        target: choice.targetSceneId,
        label: group[0].id === choice.id ? group.map(labelOf).join(" / ") : undefined,
        selected: selection?.kind === "choice" && selection.id === choice.id,
        markerEnd: { type: MarkerType.ArrowClosed },
        animated: choice.conditions.length > 0,
      };
    });
  }, [choices, selection, locale]);

  const markDirty = useCallback(() => setDirty(true), []);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const removeScenes = useCallback(
    (ids: Set<string>) => {
      setScenes((current) => current.filter((scene) => !ids.has(scene.id)));
      setChoices((current) => current.filter((choice) => !ids.has(choice.sceneId) && !ids.has(choice.targetSceneId)));
      setStartSceneId((current) => (current && ids.has(current) ? null : current));
      setSelection((current) => (current?.kind === "scene" && ids.has(current.id) ? null : current));
      markDirty();
    },
    [markDirty],
  );

  const onNodesChange = useCallback(
    (changes: NodeChange<SceneFlowNode>[]) => {
      const moved = new Map<string, { x: number; y: number }>();
      const removed = new Set<string>();
      for (const change of changes) {
        if (change.type === "position" && change.position) moved.set(change.id, change.position);
        if (change.type === "remove") removed.add(change.id);
        if (change.type === "select" && change.selected) setSelection({ kind: "scene", id: change.id });
      }
      if (moved.size > 0) {
        setScenes((current) =>
          current.map((scene) => {
            const position = moved.get(scene.id);
            return position ? { ...scene, graphX: Math.round(position.x), graphY: Math.round(position.y) } : scene;
          }),
        );
        markDirty();
      }
      if (removed.size > 0) removeScenes(removed);
    },
    [markDirty, removeScenes],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      const removed = new Set<string>();
      for (const change of changes) {
        if (change.type === "remove") removed.add(change.id);
        if (change.type === "select" && change.selected) setSelection({ kind: "choice", id: change.id });
      }
      if (removed.size > 0) {
        setChoices((current) => current.filter((choice) => !removed.has(choice.id)));
        setSelection((current) => (current?.kind === "choice" && removed.has(current.id) ? null : current));
        markDirty();
      }
    },
    [markDirty],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target || connection.source === connection.target) return;
      const id = newId();
      setChoices((current) => [
        ...current,
        {
          id,
          sceneId: connection.source,
          targetSceneId: connection.target,
          position: current.filter((choice) => choice.sceneId === connection.source).length,
          label: { [locale]: "Nova escolha" },
          conditions: [],
          effects: [],
        },
      ]);
      setSelection({ kind: "choice", id });
      markDirty();
    },
    [locale, markDirty],
  );

  function addScene() {
    const id = newId();
    const anchor = scenes.find((scene) => selection?.kind === "scene" && scene.id === selection.id) ?? scenes.at(-1);
    const scene: ChapterGraphScene = {
      id,
      label: `Cena ${scenes.length + 1}`,
      imageMediaId: null,
      body: {},
      isEnding: false,
      endingTitle: {},
      effects: [],
      graphX: anchor ? anchor.graphX + 40 : 0,
      graphY: anchor ? anchor.graphY + 220 : 0,
    };
    setScenes((current) => [...current, scene]);
    if (!startSceneId) setStartSceneId(id);
    setSelection({ kind: "scene", id });
    markDirty();
  }

  function updateScene(id: string, patch: Partial<ChapterGraphScene>) {
    setScenes((current) => current.map((scene) => (scene.id === id ? { ...scene, ...patch } : scene)));
    if (patch.isEnding) setChoices((current) => current.filter((choice) => choice.sceneId !== id));
    markDirty();
  }

  function updateChoice(id: string, patch: Partial<ChapterGraphChoice>) {
    setChoices((current) => current.map((choice) => (choice.id === id ? { ...choice, ...patch } : choice)));
    markDirty();
  }

  function moveChoice(id: string, direction: -1 | 1) {
    setChoices((current) => {
      const target = current.find((choice) => choice.id === id);
      if (!target) return current;
      const siblings = current.filter((choice) => choice.sceneId === target.sceneId).sort((a, b) => a.position - b.position);
      const index = siblings.findIndex((choice) => choice.id === id);
      const swapWith = siblings[index + direction];
      if (!swapWith) return current;
      const order = siblings.map((choice) => choice.id);
      order[index] = swapWith.id;
      order[index + direction] = id;
      return current.map((choice) => (choice.sceneId === target.sceneId ? { ...choice, position: order.indexOf(choice.id) } : choice));
    });
    markDirty();
  }

  function save() {
    const graph: ChapterGraph = { startSceneId, scenes, choices };
    startSaving(async () => {
      const result = await saveChapterGraphAction(work.id, chapter.id, graph);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setDirty(false);
      const errors = result.issues.filter((issue) => issue.severity === "error").length;
      toast.success(errors > 0 ? `Capítulo salvo. A obra ainda tem ${errors} problema(s) para publicar.` : "Capítulo salvo.");
    });
  }

  const selectedScene = selection?.kind === "scene" ? scenes.find((scene) => scene.id === selection.id) : undefined;
  const selectedChoice = selection?.kind === "choice" ? choices.find((choice) => choice.id === selection.id) : undefined;
  const chapterTitle = pickText(chapter.title, locale, locale);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1">
          <Link href={adminWorkPath(work.id)} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" />
            {pickText(work.title, locale, locale)}
          </Link>
          <h1 className="truncate text-xl font-semibold text-foreground">
            Capítulo {view.chapterNumber}: {chapterTitle}
          </h1>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={addScene}>
            <Plus className="size-4" />
            Nova cena
          </Button>
          <Button type="button" onClick={save} disabled={!dirty || saving}>
            <Save className="size-4" />
            {saving ? "Salvando..." : dirty ? "Salvar" : "Salvo"}
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Arraste da bolinha de baixo de uma cena até outra para criar uma escolha. Cena sem escolhas e sem ser final
        leva ao próximo capítulo. Selecione e aperte Delete para apagar.
      </p>

      <div className="flex flex-col gap-4 lg:flex-row">
        <div
          className="h-[60vh] min-h-80 w-full shrink-0 overflow-hidden rounded-lg border border-border bg-muted/40 lg:h-[calc(100vh-14rem)] lg:w-auto lg:flex-1"
          style={FLOW_THEME}
        >
          <ReactFlow<SceneFlowNode, Edge>
            nodes={nodes}
            edges={edges}
            nodeTypes={NODE_TYPES}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onPaneClick={() => setSelection(null)}
            fitView
            minZoom={0.2}
            deleteKeyCode={["Delete", "Backspace"]}
          >
            <Background gap={24} />
            <Controls showInteractive={false} />
          </ReactFlow>
        </div>

        <aside className="w-full space-y-4 lg:w-96 lg:shrink-0">
          {selectedScene ? (
            <SceneInspector
              key={selectedScene.id}
              scene={selectedScene}
              work={work}
              isStart={selectedScene.id === startSceneId}
              imageUrl={selectedScene.imageMediaId ? (imageUrls[selectedScene.imageMediaId] ?? null) : null}
              outgoing={choices.filter((choice) => choice.sceneId === selectedScene.id).sort((a, b) => a.position - b.position)}
              onChange={(patch) => updateScene(selectedScene.id, patch)}
              onImage={(media) => {
                if (media) setImageUrls((current) => ({ ...current, [media.id]: media.url }));
                updateScene(selectedScene.id, { imageMediaId: media?.id ?? null });
              }}
              onMakeStart={() => {
                setStartSceneId(selectedScene.id);
                markDirty();
              }}
              onSelectChoice={(id) => setSelection({ kind: "choice", id })}
              onDelete={() => removeScenes(new Set([selectedScene.id]))}
            />
          ) : selectedChoice ? (
            <ChoiceInspector
              key={selectedChoice.id}
              choice={selectedChoice}
              work={work}
              scenes={scenes}
              siblingCount={choices.filter((choice) => choice.sceneId === selectedChoice.sceneId).length}
              onChange={(patch) => updateChoice(selectedChoice.id, patch)}
              onMove={(direction) => moveChoice(selectedChoice.id, direction)}
              onSelectScene={(id) => setSelection({ kind: "scene", id })}
              onDelete={() => {
                setChoices((current) => current.filter((choice) => choice.id !== selectedChoice.id));
                setSelection(null);
                markDirty();
              }}
            />
          ) : (
            <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
              Selecione uma cena ou uma seta para editar.
            </div>
          )}

          <IssuesPanel issues={issues} onSelect={setSelection} />
        </aside>
      </div>
    </div>
  );
}

function IssuesPanel({ issues, onSelect }: { issues: StoryIssue[]; onSelect: (selection: Selection) => void }) {
  if (issues.length === 0) {
    return <p className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">Nenhum problema neste capítulo.</p>;
  }
  return (
    <div className="space-y-2 rounded-lg border border-border bg-card p-4">
      <p className="text-sm font-medium text-foreground">Problemas neste capítulo</p>
      <ul className="space-y-1">
        {issues.slice(0, 20).map((issue, index) => (
          <li key={`${issue.code}-${index}`}>
            <button
              type="button"
              className={issue.severity === "error" ? "text-left text-sm text-destructive hover:underline" : "text-left text-sm text-warning hover:underline"}
              onClick={() =>
                onSelect(
                  issue.choiceId
                    ? { kind: "choice", id: issue.choiceId }
                    : issue.sceneId
                      ? { kind: "scene", id: issue.sceneId }
                      : null,
                )
              }
            >
              {issue.message}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
