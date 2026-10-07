import { Fragment } from "react";
import { cn } from "@venore/plugin-sdk/ui";
import type { CastMember, ImageAspect, LocalizedText, SceneBlock } from "../contracts/types";
import { accentOf } from "../shared/accent";
import { parseInline } from "../shared/inline-format";
import { pickText, splitParagraphs } from "../shared/localized-text";

const ASPECT_CLASS: Record<ImageAspect, string> = {
  auto: "",
  "16:9": "aspect-video object-cover",
  "4:3": "aspect-[4/3] object-cover",
  "1:1": "aspect-square object-cover",
  "3:4": "aspect-[3/4] object-cover",
  "2:3": "aspect-[2/3] object-cover",
};

const PROSE = "font-serif text-lg leading-relaxed text-foreground";

function Inline({ text }: { text: string }) {
  return (
    <>
      {parseInline(text).map((segment, index) =>
        segment.bold ? (
          <strong key={index}>{segment.text}</strong>
        ) : segment.italic ? (
          <em key={index}>{segment.text}</em>
        ) : (
          <Fragment key={index}>{segment.text}</Fragment>
        ),
      )}
    </>
  );
}

function Paragraphs({ text, className }: { text: string; className?: string }) {
  return (
    <div className={cn("space-y-4", className)}>
      {splitParagraphs(text).map((paragraph, index) => (
        <p key={index} className="whitespace-pre-line">
          <Inline text={paragraph} />
        </p>
      ))}
    </div>
  );
}

// Cena em blocos, igual para o leitor e para a prévia do editor. Puro (sem estado): recebe o
// idioma, as URLs de mídia e o elenco. Texto continua texto em todos os blocos.
export function SceneBlocksView({
  blocks,
  locale,
  fallbackLocale,
  media,
  cast,
  eager = false,
}: {
  blocks: SceneBlock[];
  locale: string;
  fallbackLocale: string;
  media: Record<string, string>;
  cast: CastMember[];
  eager?: boolean;
}) {
  const t = (text: LocalizedText) => pickText(text, locale, fallbackLocale);
  const castById = new Map(cast.map((member) => [member.id, member]));
  const loading = eager ? "eager" : "lazy";

  return (
    <div className="space-y-6">
      {blocks.map((block) => {
        switch (block.type) {
          case "text": {
            const text = t(block.text);
            return text ? <Paragraphs key={block.id} text={text} className={cn("px-4", PROSE)} /> : null;
          }
          case "image": {
            const url = block.mediaId ? media[block.mediaId] : null;
            if (!url) return null;
            return (
              <figure key={block.id} className={block.bleed ? "" : "px-4"}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={t(block.alt)}
                  loading={loading}
                  className={cn("block w-full", block.bleed ? "" : "rounded-lg", ASPECT_CLASS[block.aspect])}
                />
              </figure>
            );
          }
          case "caption": {
            const url = block.mediaId ? media[block.mediaId] : null;
            const caption = t(block.caption);
            if (!url) return caption ? <Paragraphs key={block.id} text={caption} className={cn("px-4", PROSE)} /> : null;
            const top = block.position === "top";
            return (
              <figure key={block.id} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={t(block.alt)} loading={loading} className="block w-full" />
                {caption && (
                  <figcaption
                    className={cn(
                      "absolute inset-x-0 px-4 font-display text-base font-semibold leading-snug text-foreground sm:text-lg",
                      top
                        ? "top-0 bg-gradient-to-b from-background via-background/85 to-transparent pb-10 pt-4"
                        : "bottom-0 bg-gradient-to-t from-background via-background/85 to-transparent pb-4 pt-10",
                    )}
                  >
                    <Inline text={caption} />
                  </figcaption>
                )}
              </figure>
            );
          }
          case "speech": {
            const text = t(block.text);
            if (!text) return null;
            const member = block.castId ? castById.get(block.castId) : undefined;
            const accent = accentOf(member?.color);
            const portrait = member?.portraitMediaId ? media[member.portraitMediaId] : null;
            return (
              <div key={block.id} className="flex items-start gap-3 px-4">
                {member &&
                  (portrait ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={portrait} alt="" loading={loading} className={cn("size-11 shrink-0 rounded-full border-2 object-cover", accent.border)} />
                  ) : (
                    <span
                      aria-hidden
                      className={cn("flex size-11 shrink-0 items-center justify-center rounded-full font-semibold", accent.soft, accent.text)}
                    >
                      {t(member.name).slice(0, 1)}
                    </span>
                  ))}
                <div className={cn("min-w-0 flex-1 rounded-lg border-s-4 bg-card px-4 py-3", member ? accent.border : "border-ring")}>
                  {member && <p className={cn("text-sm font-semibold", accent.text)}>{t(member.name)}</p>}
                  <Paragraphs text={text} className={PROSE} />
                </div>
              </div>
            );
          }
          case "gallery": {
            const images = block.images.filter((image) => media[image.mediaId]);
            if (images.length === 0) return null;
            return (
              <div key={block.id} className={cn("grid gap-2 px-4", images.length === 3 ? "sm:grid-cols-3" : images.length === 2 ? "sm:grid-cols-2" : "")}>
                {images.map((image) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={image.mediaId}
                    src={media[image.mediaId]}
                    alt={t(image.alt)}
                    loading={loading}
                    className="block aspect-[3/4] w-full rounded-lg object-cover"
                  />
                ))}
              </div>
            );
          }
          case "divider":
            if (block.style === "space") return <div key={block.id} aria-hidden className="h-12" />;
            if (block.style === "line") return <hr key={block.id} className="mx-auto w-1/3 border-border" />;
            return (
              <p key={block.id} aria-hidden className="text-center text-lg tracking-widest text-muted-foreground">
                • • •
              </p>
            );
          case "backdrop": {
            // Imagem no topo, esmaecendo na cor de fundo do site (tema e modo claro/escuro); o texto
            // começa sobre a parte de baixo, já no degradê.
            const url = block.mediaId ? media[block.mediaId] : null;
            const text = t(block.text);
            return (
              <div key={block.id}>
                {url && (
                  <div className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={t(block.alt)} loading={loading} className="block aspect-[4/5] w-full object-cover sm:aspect-video" />
                    <div aria-hidden className="absolute inset-x-0 bottom-0 h-3/4 bg-gradient-to-b from-transparent via-background/85 to-background" />
                  </div>
                )}
                {text && <Paragraphs text={text} className={cn("relative px-4", PROSE, url && "-mt-24 sm:-mt-32")} />}
              </div>
            );
          }
        }
      })}
    </div>
  );
}
