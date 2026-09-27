"use client";

import { useState } from "react";
import { Flag, Trash2 } from "lucide-react";
import { Button, Input, MediaPickerField, Switch, Textarea } from "@venore/plugin-sdk/ui";
import type { PickableMedia } from "@venore/plugin-sdk/ui";
import type { ChapterGraphChoice, ChapterGraphScene } from "../../contracts/types";
import type { ChapterGraphEditorView } from "../../features/graph/get-chapter-graph/types";
import { LocaleTabs } from "../../components/locale-tabs";
import { pickText } from "../../shared/localized-text";
import { EffectsEditor } from "./rule-editors";

export function SceneInspector({
  scene,
  work,
  isStart,
  imageUrl,
  outgoing,
  onChange,
  onImage,
  onMakeStart,
  onSelectChoice,
  onDelete,
}: {
  scene: ChapterGraphScene;
  work: ChapterGraphEditorView["work"];
  isStart: boolean;
  imageUrl: string | null;
  outgoing: ChapterGraphChoice[];
  onChange: (patch: Partial<ChapterGraphScene>) => void;
  onImage: (media: PickableMedia | null) => void;
  onMakeStart: () => void;
  onSelectChoice: (id: string) => void;
  onDelete: () => void;
}) {
  const [locale, setLocale] = useState(work.defaultLocale);

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
        <span className="text-xs text-muted-foreground">Só você vê. O leitor vê a lâmina e o texto.</span>
      </label>

      <MediaPickerField
        name="imageMediaId"
        label="Lâmina (imagem)"
        initialMedia={scene.imageMediaId && imageUrl ? { id: scene.imageMediaId, url: imageUrl, filename: "lâmina", contentType: "image/*" } : null}
        onSelect={onImage}
      />

      <LocaleTabs locales={work.locales} active={locale} defaultLocale={work.defaultLocale} onChange={setLocale} />
      <label className="block space-y-1 text-sm">
        <span className="font-medium text-foreground">Texto</span>
        <Textarea
          rows={8}
          value={scene.body[locale] ?? ""}
          maxLength={20000}
          placeholder="Parágrafos separados por uma linha em branco."
          onChange={(event) => onChange({ body: { ...scene.body, [locale]: event.target.value } })}
        />
      </label>

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
