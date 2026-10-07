"use client";

import { useEffect, useState } from "react";
import {
  AlignLeft,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Eye,
  GalleryHorizontal,
  GripVertical,
  Image as ImageIcon,
  MessageSquareQuote,
  Minus,
  PanelRightClose,
  PanelRightOpen,
  Pencil,
  Plus,
  Sparkles,
  SquareDashedBottom,
  Trash2,
  Maximize2,
  Minimize2,
  type LucideIcon,
} from "lucide-react";
import { Button, cn, Input, Switch, type PickableMedia } from "@venore/plugin-sdk/ui";
import type { ChapterGraphChoice, ChapterGraphScene, SceneBlock, SceneBlockType } from "../../contracts/types";
import type { ChapterGraphEditorView } from "../../features/graph/get-chapter-graph/types";
import { LocaleTabs } from "../../components/locale-tabs";
import { SceneBlocksView } from "../../components/scene-blocks-view";
import { useDragReorder } from "../../components/use-drag-reorder";
import { pickText } from "../../shared/localized-text";
import { BLOCK_HINTS, BLOCK_LABELS, newBlock, sceneWordStats } from "../../shared/scene-blocks";
import { BlockEditor } from "./block-editors";
import { EffectsEditor } from "./rule-editors";

const BLOCK_ICONS: Record<SceneBlockType, LucideIcon> = {
  text: AlignLeft,
  image: ImageIcon,
  caption: SquareDashedBottom,
  speech: MessageSquareQuote,
  gallery: GalleryHorizontal,
  divider: Minus,
  backdrop: Sparkles,
};
const ADD_ORDER: SceneBlockType[] = ["text", "speech", "image", "caption", "backdrop", "gallery", "divider"];

const minutes = (value: number) => (value < 1 ? "menos de 1 min" : `${Math.round(value)} min`);

// Editor da cena em tela cheia (0.9.0): o texto na largura de leitura do leitor, a cena como
// sequência de blocos, o resto (final, efeitos, escolhas) num painel lateral recolhível. "Foco"
// (Ctrl+.) esconde tudo menos o texto; Esc sai do foco e depois fecha o editor.
export function SceneEditor({
  scene,
  work,
  cast,
  media,
  isStart,
  outgoing,
  scenes,
  onChange,
  onMedia,
  onMakeStart,
  onSelectScene,
  onSelectChoice,
  onClose,
}: {
  scene: ChapterGraphScene;
  work: ChapterGraphEditorView["work"];
  cast: ChapterGraphEditorView["cast"];
  media: Record<string, string>;
  isStart: boolean;
  outgoing: ChapterGraphChoice[];
  scenes: ChapterGraphScene[];
  onChange: (patch: Partial<ChapterGraphScene>) => void;
  onMedia: (media: PickableMedia) => void;
  onMakeStart: () => void;
  onSelectScene: (id: string) => void;
  onSelectChoice: (id: string) => void;
  onClose: () => void;
}) {
  const [locale, setLocale] = useState(work.defaultLocale);
  const [focus, setFocus] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const [preview, setPreview] = useState(false);
  const blocks = scene.blocks;
  const context = { locale, defaultLocale: work.defaultLocale, media, cast, onMedia };
  const stats = sceneWordStats(blocks, locale);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      // Um diálogo nativo aberto (seletor de mídia) cuida do próprio Esc.
      if (document.querySelector("dialog[open]")) return;
      if ((event.ctrlKey || event.metaKey) && event.key === ".") {
        event.preventDefault();
        setFocus((current) => !current);
      } else if (event.key === "Escape") {
        event.preventDefault();
        if (focus) setFocus(false);
        else onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focus, onClose]);

  const setBlocks = (next: SceneBlock[]) => onChange({ blocks: next });
  const insertAt = (index: number, type: SceneBlockType) => {
    const next = [...blocks];
    next.splice(index, 0, newBlock(type, crypto.randomUUID()));
    setBlocks(next);
  };
  const reorder = useDragReorder(
    blocks.map((block) => block.id),
    (orderedIds) => setBlocks(orderedIds.map((id) => blocks.find((block) => block.id === id)!).filter(Boolean)),
  );
  const byId = new Map(blocks.map((block) => [block.id, block]));
  const showPanel = panelOpen && !focus;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background" role="dialog" aria-modal="true" aria-label="Editor da cena">
      <header className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2 sm:px-4">
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>
          <ArrowLeft className="size-4" />
          <span className="hidden sm:inline">Grafo</span>
        </Button>
        {!focus && (
          <select
            aria-label="Ir para outra cena"
            value={scene.id}
            onChange={(event) => onSelectScene(event.target.value)}
            className="h-8 max-w-48 truncate rounded-md border border-border bg-background px-2 text-sm text-foreground"
          >
            {scenes.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.label || "Cena sem nome"}
              </option>
            ))}
          </select>
        )}
        <div className="ms-auto flex flex-wrap items-center gap-1">
          <LocaleTabs locales={work.locales} active={locale} defaultLocale={work.defaultLocale} onChange={setLocale} />
          <Button type="button" size="sm" variant={preview ? "secondary" : "ghost"} aria-pressed={preview} onClick={() => setPreview((current) => !current)}>
            {preview ? <Pencil className="size-4" /> : <Eye className="size-4" />}
            <span className="hidden sm:inline">{preview ? "Editar" : "Ver como o leitor"}</span>
          </Button>
          <Button
            type="button"
            size="sm"
            variant={focus ? "secondary" : "ghost"}
            aria-pressed={focus}
            onClick={() => setFocus((current) => !current)}
            title="Foco (Ctrl+.)"
          >
            {focus ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
            <span className="hidden sm:inline">Foco</span>
          </Button>
          {!focus && (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label={panelOpen ? "Esconder painel da cena" : "Mostrar painel da cena"}
              onClick={() => setPanelOpen((current) => !current)}
              className="hidden lg:inline-flex"
            >
              {panelOpen ? <PanelRightClose className="size-4" /> : <PanelRightOpen className="size-4" />}
            </Button>
          )}
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <main className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-2xl py-8">
            {!focus && (
              <div className="px-4 pb-6">
                <input
                  value={scene.label}
                  maxLength={200}
                  onChange={(event) => onChange({ label: event.target.value })}
                  placeholder="Nome da cena (só você vê)"
                  aria-label="Nome da cena"
                  className="w-full bg-transparent font-display text-2xl font-semibold text-foreground outline-none placeholder:text-muted-foreground/56"
                />
              </div>
            )}

            {preview ? (
              blocks.length > 0 ? (
                <SceneBlocksView blocks={blocks} locale={locale} fallbackLocale={work.defaultLocale} media={media} cast={cast} eager />
              ) : (
                <p className="px-4 text-sm text-muted-foreground">Cena vazia.</p>
              )
            ) : (
              <ol className="space-y-2">
                {reorder.order.map((id, index) => {
                  const block = byId.get(id);
                  if (!block) return null;
                  const Icon = BLOCK_ICONS[block.type];
                  return (
                    <li key={block.id} className="group/block">
                      {index === 0 && <AddBlockBar onAdd={(type) => insertAt(0, type)} />}
                      <div
                        {...reorder.targetProps(block.id)}
                        className={cn(
                          "relative rounded-xl border border-transparent px-4 py-3 transition-colors focus-within:border-border hover:border-border",
                          block.type !== "text" && "bg-muted/30",
                          reorder.dragging === block.id && "opacity-50",
                        )}
                      >
                        <div className="mb-2 flex items-center gap-1 text-xs text-muted-foreground opacity-70 group-hover/block:opacity-100">
                          <span {...reorder.handleProps(block.id)} className="cursor-grab" title="Arraste para mover">
                            <GripVertical className="size-3.5" aria-hidden />
                          </span>
                          <Icon className="size-3.5" aria-hidden />
                          <span title={BLOCK_HINTS[block.type]}>{BLOCK_LABELS[block.type]}</span>
                          <span className="ms-auto flex">
                            <Button type="button" size="icon" variant="ghost" className="size-7" aria-label="Subir bloco" disabled={index === 0} onClick={() => reorder.moveBy(block.id, -1)}>
                              <ArrowUp className="size-3.5" />
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="size-7"
                              aria-label="Descer bloco"
                              disabled={index === blocks.length - 1}
                              onClick={() => reorder.moveBy(block.id, 1)}
                            >
                              <ArrowDown className="size-3.5" />
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="size-7"
                              aria-label="Remover bloco"
                              onClick={() => setBlocks(blocks.filter((other) => other.id !== block.id))}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </span>
                        </div>
                        <BlockEditor
                          block={block}
                          context={context}
                          onChange={(next) => setBlocks(blocks.map((other) => (other.id === block.id ? next : other)))}
                        />
                      </div>
                      <AddBlockBar onAdd={(type) => insertAt(index + 1, type)} />
                    </li>
                  );
                })}
                {blocks.length === 0 && (
                  <li className="px-4">
                    <p className="pb-3 text-sm text-muted-foreground">Cena vazia. Comece por um bloco:</p>
                    <AddBlockMenu onAdd={(type) => insertAt(0, type)} />
                  </li>
                )}
              </ol>
            )}
          </div>
        </main>

        {showPanel && (
          <aside className="w-full shrink-0 space-y-6 overflow-y-auto border-t border-border bg-card p-4 lg:w-80 lg:border-s lg:border-t-0">
            <div className="space-y-2">
              <p className="text-sm font-semibold text-foreground">Cena</p>
              <Button type="button" size="sm" variant={isStart ? "secondary" : "outline"} disabled={isStart} onClick={onMakeStart}>
                {isStart ? "Cena inicial do capítulo" : "Tornar cena inicial"}
              </Button>
              <label className="flex items-center justify-between gap-2 text-sm">
                <span className="font-medium text-foreground">É um final</span>
                <Switch checked={scene.isEnding} onCheckedChange={(checked: boolean) => onChange({ isEnding: checked })} />
              </label>
              {scene.isEnding && (
                <label className="block space-y-1 text-sm">
                  <span className="font-medium text-foreground">Nome do final</span>
                  <Input
                    value={scene.endingTitle[locale] ?? ""}
                    maxLength={200}
                    placeholder="Ex: A luz que guia"
                    onChange={(event) => onChange({ endingTitle: { ...scene.endingTitle, [locale]: event.target.value } })}
                  />
                </label>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-sm font-semibold text-foreground">Ao entrar nesta cena</p>
              <EffectsEditor variables={work.variables} effects={scene.effects} onChange={(effects) => onChange({ effects })} />
            </div>

            {!scene.isEnding && (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-foreground">Escolhas</p>
                {outgoing.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nenhuma: o leitor segue para o próximo capítulo. Crie escolhas ligando as cenas no grafo.</p>
                ) : (
                  <ul className="space-y-1">
                    {outgoing.map((choice) => (
                      <li key={choice.id}>
                        <button type="button" className="text-left text-sm text-primary hover:underline" onClick={() => onSelectChoice(choice.id)}>
                          {pickText(choice.label, locale, work.defaultLocale) || "(sem texto)"}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </aside>
        )}
      </div>

      <footer className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border px-4 py-2 text-xs text-muted-foreground">
        <span>{stats.words.toLocaleString("pt-BR")} palavras</span>
        <span>Leitura: {minutes(stats.readingMinutes)}</span>
        <span>Áudio: {minutes(stats.audioMinutes)}</span>
        <span className="ms-auto hidden sm:inline">Ctrl+. foco · Esc sai</span>
      </footer>
    </div>
  );
}

function AddBlockBar({ onAdd }: { onAdd: (type: SceneBlockType) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="group/add relative flex h-6 items-center justify-center">
      <span aria-hidden className="absolute inset-x-4 top-1/2 h-px bg-border opacity-0 transition-opacity group-hover/add:opacity-100" />
      {open ? (
        <div className="relative z-10 rounded-xl border border-border bg-popover p-2 shadow-lg">
          <AddBlockMenu
            onAdd={(type) => {
              onAdd(type);
              setOpen(false);
            }}
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Adicionar bloco aqui"
          className="relative z-10 flex size-6 items-center justify-center rounded-full border border-border bg-background text-muted-foreground opacity-40 transition-opacity hover:text-foreground focus:opacity-100 group-hover/add:opacity-100"
        >
          <Plus className="size-3.5" />
        </button>
      )}
    </div>
  );
}

function AddBlockMenu({ onAdd }: { onAdd: (type: SceneBlockType) => void }) {
  return (
    <div className="flex flex-wrap gap-1">
      {ADD_ORDER.map((type) => {
        const Icon = BLOCK_ICONS[type];
        return (
          <Button key={type} type="button" size="sm" variant="outline" title={BLOCK_HINTS[type]} onClick={() => onAdd(type)}>
            <Icon className="size-4" />
            {BLOCK_LABELS[type]}
          </Button>
        );
      })}
    </div>
  );
}
