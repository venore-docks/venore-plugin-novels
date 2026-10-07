"use client";

import { useRef } from "react";
import { Bold, Italic, Trash2 } from "lucide-react";
import { Button, cn, MediaPickerField, Switch, type PickableMedia } from "@venore/plugin-sdk/ui";
import {
  CAPTION_MAX_CHARS,
  IMAGE_ASPECTS,
  type CastMemberRecord,
  type LocalizedText,
  type SceneBlock,
} from "../../contracts/types";
import { accentOf } from "../../shared/accent";
import { pickText } from "../../shared/localized-text";

type BlockOf<T extends SceneBlock["type"]> = Extract<SceneBlock, { type: T }>;

export type BlockEditorContext = {
  locale: string;
  defaultLocale: string;
  media: Record<string, string>;
  cast: CastMemberRecord[];
  onMedia: (media: PickableMedia) => void;
};

const ASPECT_LABELS: Record<(typeof IMAGE_ASPECTS)[number], string> = {
  auto: "Original",
  "16:9": "Paisagem 16:9",
  "4:3": "4:3",
  "1:1": "Quadrada",
  "3:4": "Retrato 3:4",
  "2:3": "Livro 2:3",
};

const PROSE_EDITOR =
  "w-full resize-none overflow-hidden bg-transparent font-serif text-lg leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/56";

// Textarea que cresce com o texto, na mesma fonte e espaçamento do leitor. B / I envolvem a
// seleção em **…** / *…*.
export function ProseField({
  value,
  onChange,
  placeholder,
  maxLength = 20000,
  className,
  toolbar = true,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  className?: string;
  toolbar?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const grow = (element: HTMLTextAreaElement | null) => {
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${element.scrollHeight}px`;
  };
  const wrap = (marker: string) => {
    const element = ref.current;
    if (!element) return;
    const { selectionStart: start, selectionEnd: end } = element;
    if (start === end) return;
    const next = `${value.slice(0, start)}${marker}${value.slice(start, end)}${marker}${value.slice(end)}`;
    onChange(next);
    requestAnimationFrame(() => {
      element.focus();
      element.setSelectionRange(start + marker.length, end + marker.length);
    });
  };
  return (
    <div className="space-y-1">
      {toolbar && (
        <div className="flex gap-1 opacity-60 focus-within:opacity-100 hover:opacity-100">
          <Button type="button" size="icon" variant="ghost" className="size-7" aria-label="Negrito (selecione o texto)" onClick={() => wrap("**")}>
            <Bold className="size-3.5" />
          </Button>
          <Button type="button" size="icon" variant="ghost" className="size-7" aria-label="Itálico (selecione o texto)" onClick={() => wrap("*")}>
            <Italic className="size-3.5" />
          </Button>
        </div>
      )}
      <textarea
        ref={(element) => {
          ref.current = element;
          grow(element);
        }}
        value={value}
        rows={3}
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={(event) => {
          onChange(event.target.value);
          grow(event.target);
        }}
        className={cn(PROSE_EDITOR, className)}
      />
    </div>
  );
}

function localizedPatch(text: LocalizedText, locale: string, value: string): LocalizedText {
  return { ...text, [locale]: value };
}

function MediaField({
  label,
  mediaId,
  context,
  onPick,
}: {
  label: string;
  mediaId: string | null;
  context: BlockEditorContext;
  onPick: (mediaId: string | null) => void;
}) {
  const url = mediaId ? context.media[mediaId] : null;
  return (
    <MediaPickerField
      key={mediaId ?? "vazio"}
      name="media"
      label={label}
      initialMedia={mediaId && url ? { id: mediaId, url, filename: "imagem", contentType: "image/*" } : null}
      onSelect={(media) => {
        if (media) context.onMedia(media);
        onPick(media?.id ?? null);
      }}
    />
  );
}

function AltField({ value, context, onChange }: { value: LocalizedText; context: BlockEditorContext; onChange: (value: LocalizedText) => void }) {
  return (
    <label className="block space-y-1 text-xs text-muted-foreground">
      Texto alternativo (para leitor de tela)
      <input
        value={value[context.locale] ?? ""}
        onChange={(event) => onChange(localizedPatch(value, context.locale, event.target.value))}
        maxLength={200}
        placeholder="O que a imagem mostra"
        className="h-8 w-full rounded-md border border-border bg-background px-2 text-sm text-foreground"
      />
    </label>
  );
}

function ImagePreview({ mediaId, context, className }: { mediaId: string | null; context: BlockEditorContext; className?: string }) {
  const url = mediaId ? context.media[mediaId] : null;
  if (!url) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" className={cn("block w-full rounded-md object-cover", className)} />;
}

// Editor de cada tipo de bloco. `onChange` recebe o bloco inteiro atualizado.
export function BlockEditor({
  block,
  context,
  onChange,
}: {
  block: SceneBlock;
  context: BlockEditorContext;
  onChange: (block: SceneBlock) => void;
}) {
  const { locale } = context;
  switch (block.type) {
    case "text":
      return (
        <ProseField
          value={block.text[locale] ?? ""}
          placeholder="Escreva a cena. Linha em branco separa parágrafos."
          onChange={(value) => onChange({ ...block, text: localizedPatch(block.text, locale, value) })}
        />
      );
    case "image":
      return <ImageBlockEditor block={block} context={context} onChange={onChange} />;
    case "caption": {
      const caption = block.caption[locale] ?? "";
      return (
        <div className="space-y-3">
          <div className="relative">
            <ImagePreview mediaId={block.mediaId} context={context} />
          </div>
          <MediaField label="Imagem" mediaId={block.mediaId} context={context} onPick={(mediaId) => onChange({ ...block, mediaId })} />
          <label className="block space-y-1 text-sm">
            <span className="flex justify-between text-xs text-muted-foreground">
              Legenda sobre a imagem
              <span className={cn("tabular-nums", caption.length > CAPTION_MAX_CHARS ? "text-destructive" : "")}>
                {caption.length}/{CAPTION_MAX_CHARS}
              </span>
            </span>
            <ProseField
              value={caption}
              toolbar={false}
              maxLength={400}
              placeholder="Texto curto. Para um parágrafo longo, use imagem + bloco de texto."
              onChange={(value) => onChange({ ...block, caption: localizedPatch(block.caption, locale, value) })}
              className="text-base"
            />
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              Posição
              <select
                value={block.position}
                onChange={(event) => onChange({ ...block, position: event.target.value === "top" ? "top" : "bottom" })}
                className="h-8 rounded-md border border-border bg-background px-2 text-sm text-foreground"
              >
                <option value="bottom">Embaixo</option>
                <option value="top">Em cima</option>
              </select>
            </label>
          </div>
          <AltField value={block.alt} context={context} onChange={(alt) => onChange({ ...block, alt })} />
        </div>
      );
    }
    case "speech":
      return <SpeechBlockEditor block={block} context={context} onChange={onChange} />;
    case "gallery":
      return (
        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-3">
            {block.images.map((image, index) => (
              <div key={`${image.mediaId}-${index}`} className="space-y-1">
                <ImagePreview mediaId={image.mediaId} context={context} className="aspect-[3/4]" />
                <input
                  value={image.alt[locale] ?? ""}
                  onChange={(event) =>
                    onChange({
                      ...block,
                      images: block.images.map((other, position) =>
                        position === index ? { ...other, alt: localizedPatch(other.alt, locale, event.target.value) } : other,
                      ),
                    })
                  }
                  placeholder="Texto alternativo"
                  aria-label={`Texto alternativo da imagem ${index + 1}`}
                  className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs text-foreground"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => onChange({ ...block, images: block.images.filter((_, position) => position !== index) })}
                >
                  <Trash2 className="size-3.5" />
                  Tirar
                </Button>
              </div>
            ))}
          </div>
          {block.images.length < 3 && (
            <MediaField
              label={`Adicionar imagem (${block.images.length}/3)`}
              mediaId={null}
              context={context}
              onPick={(mediaId) => mediaId && onChange({ ...block, images: [...block.images, { mediaId, alt: {} }] })}
            />
          )}
        </div>
      );
    case "divider":
      return (
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          Estilo
          <select
            value={block.style}
            onChange={(event) => onChange({ ...block, style: event.target.value as BlockOf<"divider">["style"] })}
            className="h-8 rounded-md border border-border bg-background px-2 text-sm text-foreground"
          >
            <option value="dots">• • •</option>
            <option value="line">Linha</option>
            <option value="space">Espaço em branco</option>
          </select>
        </label>
      );
    case "backdrop":
      return (
        <div className="space-y-3">
          <div className="relative overflow-hidden rounded-md">
            <ImagePreview mediaId={block.mediaId} context={context} className="aspect-video rounded-none" />
            {block.mediaId && <div aria-hidden className="absolute inset-x-0 bottom-0 h-3/4 bg-gradient-to-b from-transparent via-background/85 to-background" />}
          </div>
          <MediaField label="Imagem de fundo" mediaId={block.mediaId} context={context} onPick={(mediaId) => onChange({ ...block, mediaId })} />
          <ProseField
            value={block.text[locale] ?? ""}
            placeholder="Texto que começa sobre o degradê, na cor de fundo do site."
            onChange={(value) => onChange({ ...block, text: localizedPatch(block.text, locale, value) })}
          />
          <AltField value={block.alt} context={context} onChange={(alt) => onChange({ ...block, alt })} />
        </div>
      );
  }
}

function ImageBlockEditor({ block, context, onChange }: { block: BlockOf<"image">; context: BlockEditorContext; onChange: (block: SceneBlock) => void }) {
  return (
    <div className="space-y-3">
      <ImagePreview mediaId={block.mediaId} context={context} />
      <MediaField label="Imagem" mediaId={block.mediaId} context={context} onPick={(mediaId) => onChange({ ...block, mediaId })} />
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          Proporção
          <select
            value={block.aspect}
            onChange={(event) => onChange({ ...block, aspect: event.target.value as BlockOf<"image">["aspect"] })}
            className="h-8 rounded-md border border-border bg-background px-2 text-sm text-foreground"
          >
            {IMAGE_ASPECTS.map((aspect) => (
              <option key={aspect} value={aspect}>
                {ASPECT_LABELS[aspect]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <Switch checked={block.bleed} onCheckedChange={(checked: boolean) => onChange({ ...block, bleed: checked })} />
          De borda a borda
        </label>
      </div>
      <AltField value={block.alt} context={context} onChange={(alt) => onChange({ ...block, alt })} />
    </div>
  );
}

function SpeechBlockEditor({ block, context, onChange }: { block: BlockOf<"speech">; context: BlockEditorContext; onChange: (block: SceneBlock) => void }) {
  const member = context.cast.find((candidate) => candidate.id === block.castId);
  const accent = accentOf(member?.color);
  return (
    <div className={cn("space-y-2 rounded-md border-s-4 ps-3", member ? accent.border : "border-ring")}>
      {context.cast.length === 0 ? (
        <p className="text-xs text-warning">Ninguém no elenco. Crie personagens na aba Elenco da obra.</p>
      ) : (
        <select
          value={block.castId ?? ""}
          onChange={(event) => onChange({ ...block, castId: event.target.value || null })}
          aria-label="Quem fala"
          className={cn("h-8 rounded-md border border-border bg-background px-2 text-sm font-semibold", member ? accent.text : "text-foreground")}
        >
          <option value="">Quem fala?</option>
          {context.cast.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>
              {pickText(candidate.name, context.locale, context.defaultLocale)}
            </option>
          ))}
        </select>
      )}
      <ProseField
        value={block.text[context.locale] ?? ""}
        placeholder="A fala."
        onChange={(value) => onChange({ ...block, text: localizedPatch(block.text, context.locale, value) })}
      />
    </div>
  );
}
