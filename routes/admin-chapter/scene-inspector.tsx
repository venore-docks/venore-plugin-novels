"use client";

import { Flag, PenLine, Trash2 } from "lucide-react";
import { Button, Input, Switch } from "@venore/plugin-sdk/ui";
import type { ChapterGraphChoice, ChapterGraphScene, SceneBlockType } from "../../contracts/types";
import type { ChapterGraphEditorView } from "../../features/graph/get-chapter-graph/types";
import { pickText } from "../../shared/localized-text";
import { BLOCK_LABELS, firstImageId, sceneExcerpt, sceneWordStats } from "../../shared/scene-blocks";
import { EffectsEditor } from "./rule-editors";

// Painel lateral do grafo para a cena selecionada: resumo do conteúdo (o texto em si é escrito no
// editor em tela cheia), final, efeitos e escolhas.
export function SceneInspector({
  scene,
  work,
  isStart,
  media,
  outgoing,
  onChange,
  onOpenEditor,
  onMakeStart,
  onSelectChoice,
  onDelete,
}: {
  scene: ChapterGraphScene;
  work: ChapterGraphEditorView["work"];
  isStart: boolean;
  media: Record<string, string>;
  outgoing: ChapterGraphChoice[];
  onChange: (patch: Partial<ChapterGraphScene>) => void;
  onOpenEditor: () => void;
  onMakeStart: () => void;
  onSelectChoice: (id: string) => void;
  onDelete: () => void;
}) {
  const locale = work.defaultLocale;
  const excerpt = sceneExcerpt(scene.blocks, locale, locale, 220);
  const imageId = firstImageId(scene.blocks);
  const counts = new Map<SceneBlockType, number>();
  for (const block of scene.blocks) counts.set(block.type, (counts.get(block.type) ?? 0) + 1);
  const words = sceneWordStats(scene.blocks, locale).words;

  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-foreground">Cena</p>
        <div className="flex gap-1">
          <Button type="button" size="sm" variant={isStart ? "secondary" : "outline"} disabled={isStart} onClick={onMakeStart}>
            <Flag className="size-4" />
            {isStart ? "Cena inicial" : "Tornar inicial"}
          </Button>
          <Button type="button" size="icon" variant="ghost" aria-label="Excluir cena" onClick={onDelete}>
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      <label className="block space-y-1 text-sm">
        <span className="font-medium text-foreground">Nome no editor</span>
        <Input value={scene.label} maxLength={200} onChange={(event) => onChange({ label: event.target.value })} />
        <span className="text-xs text-muted-foreground">Só você vê. O leitor vê os blocos da cena.</span>
      </label>

      <button
        type="button"
        onClick={onOpenEditor}
        className="block w-full overflow-hidden rounded-lg border border-border text-left transition-colors hover:border-ring"
      >
        {imageId && media[imageId] && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={media[imageId]} alt="" className="h-24 w-full object-cover" />
        )}
        <span className="block space-y-1 p-3">
          <span className="line-clamp-4 block font-serif text-sm text-foreground">{excerpt || "Cena vazia. Clique para escrever."}</span>
          <span className="block text-xs text-muted-foreground">
            {[...counts.entries()].map(([type, count]) => `${count} ${BLOCK_LABELS[type].toLowerCase()}`).join(" · ") || "sem blocos"}
            {words > 0 && ` · ${words} palavras`}
          </span>
        </span>
      </button>
      <Button type="button" className="w-full" onClick={onOpenEditor}>
        <PenLine className="size-4" />
        Escrever a cena
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

      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">Ao entrar nesta cena</p>
        <EffectsEditor variables={work.variables} effects={scene.effects} onChange={(effects) => onChange({ effects })} />
      </div>

      {!scene.isEnding && (
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">Escolhas</p>
          {outgoing.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhuma: o leitor segue para o próximo capítulo.</p>
          ) : (
            <ul className="space-y-1">
              {outgoing.map((choice) => (
                <li key={choice.id}>
                  <button type="button" className="text-left text-sm text-primary hover:underline" onClick={() => onSelectChoice(choice.id)}>
                    {pickText(choice.label, work.defaultLocale, work.defaultLocale) || "(sem texto)"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
