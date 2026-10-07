import {
  CAPTION_MAX_CHARS,
  DIVIDER_STYLES,
  IMAGE_ASPECTS,
  type CastMember,
  type LocalizedText,
  type SceneBlock,
  type SceneBlockType,
} from "../contracts/types";
import { stripInline } from "./inline-format";
import { normalizeLocalizedText, pickText } from "./localized-text";

// Regras puras dos blocos de uma cena (0.9.0): fábrica, texto por idioma (leitura em voz alta,
// trecho no grafo), mídia usada e normalização antes de gravar.

export const BLOCK_LABELS: Record<SceneBlockType, string> = {
  text: "Texto",
  image: "Imagem larga",
  caption: "Imagem com legenda",
  speech: "Fala",
  gallery: "Galeria",
  divider: "Separador",
  backdrop: "Imagem de fundo esmaecida",
};

export const BLOCK_HINTS: Record<SceneBlockType, string> = {
  text: "Narração. **negrito**, *itálico*; linha em branco separa parágrafos.",
  image: "Ilustração entre parágrafos, na largura da coluna ou de borda a borda.",
  caption: `Quadro de graphic novel: imagem com texto curto por cima (até ${CAPTION_MAX_CHARS} caracteres).`,
  speech: "Diálogo destacado, com o nome e a cor de alguém do elenco.",
  gallery: "Duas ou três imagens lado a lado (empilhadas no celular).",
  divider: "Pausa dramática ou passagem de tempo.",
  backdrop: "Imagem no topo, esmaecendo na cor de fundo do site; o texto fica no degradê.",
};

export function newBlock(type: SceneBlockType, id: string): SceneBlock {
  switch (type) {
    case "text":
      return { id, type, text: {} };
    case "image":
      return { id, type, mediaId: null, alt: {}, aspect: "auto", bleed: false };
    case "caption":
      return { id, type, mediaId: null, alt: {}, caption: {}, position: "bottom" };
    case "speech":
      return { id, type, castId: null, text: {} };
    case "gallery":
      return { id, type, images: [] };
    case "divider":
      return { id, type, style: "dots" };
    case "backdrop":
      return { id, type, mediaId: null, alt: {}, text: {} };
  }
}

// Campos de texto narrativo de um bloco (os que pedem tradução e viram áudio).
export function blockTextFields(block: SceneBlock): LocalizedText[] {
  switch (block.type) {
    case "text":
    case "speech":
    case "backdrop":
      return [block.text];
    case "caption":
      return [block.caption];
    default:
      return [];
  }
}

export function blockMediaIds(block: SceneBlock): string[] {
  switch (block.type) {
    case "image":
    case "caption":
    case "backdrop":
      return block.mediaId ? [block.mediaId] : [];
    case "gallery":
      return block.images.map((image) => image.mediaId);
    default:
      return [];
  }
}

export function sceneMediaIds(blocks: SceneBlock[]): string[] {
  return blocks.flatMap(blockMediaIds);
}

export function firstImageId(blocks: SceneBlock[]): string | null {
  return sceneMediaIds(blocks)[0] ?? null;
}

// Texto da cena escrito NAQUELE idioma (sem cair pro principal): é o que a leitura em voz alta
// narra. A fala ganha o nome de quem fala, para o ouvinte saber quem é.
export function sceneTextIn(blocks: SceneBlock[], locale: string, cast: CastMember[] = []): string {
  const castById = new Map(cast.map((member) => [member.id, member]));
  const parts: string[] = [];
  for (const block of blocks) {
    const [field] = blockTextFields(block);
    const text = field?.[locale]?.trim();
    if (!text) continue;
    const plain = stripInline(text);
    if (block.type === "speech" && block.castId) {
      const name = castById.get(block.castId)?.name[locale]?.trim();
      parts.push(name ? `${name}: ${plain}` : plain);
    } else {
      parts.push(plain);
    }
  }
  return parts.join("\n\n");
}

// Trecho para o nó do grafo e listas: primeiro texto, com o fallback de idioma.
export function sceneExcerpt(blocks: SceneBlock[], locale: string, fallbackLocale: string, max = 120): string {
  for (const block of blocks) {
    const [field] = blockTextFields(block);
    const text = field ? stripInline(pickText(field, locale, fallbackLocale)).trim() : "";
    if (text) return text.slice(0, max);
  }
  return "";
}

export function sceneHasText(blocks: SceneBlock[]): boolean {
  return blocks.some((block) => blockTextFields(block).some((field) => Object.values(field).some((value) => value.trim())));
}

// Contagem para o rodapé do editor: palavras, leitura (~220 palavras/min) e áudio (~150/min).
export function sceneWordStats(blocks: SceneBlock[], locale: string): { words: number; readingMinutes: number; audioMinutes: number } {
  const text = sceneTextIn(blocks, locale);
  const words = text.split(/\s+/).filter(Boolean).length;
  return { words, readingMinutes: words / 220, audioMinutes: words / 150 };
}

// Antes de gravar: textos aparados e só nos idiomas da obra, valores fora da lista voltam ao padrão.
export function normalizeBlocks(blocks: SceneBlock[], locales: string[]): SceneBlock[] {
  const text = (value: LocalizedText) => normalizeLocalizedText(value, locales);
  return blocks.map((block): SceneBlock => {
    switch (block.type) {
      case "text":
      case "speech":
        return { ...block, text: text(block.text) };
      case "image":
        return {
          ...block,
          alt: text(block.alt),
          aspect: IMAGE_ASPECTS.includes(block.aspect) ? block.aspect : "auto",
          bleed: Boolean(block.bleed),
        };
      case "caption":
        return { ...block, alt: text(block.alt), caption: text(block.caption), position: block.position === "top" ? "top" : "bottom" };
      case "gallery":
        return { ...block, images: block.images.map((image) => ({ mediaId: image.mediaId, alt: text(image.alt) })) };
      case "divider":
        return { ...block, style: DIVIDER_STYLES.includes(block.style) ? block.style : "dots" };
      case "backdrop":
        return { ...block, alt: text(block.alt), text: text(block.text) };
    }
  });
}

// Converte o formato antigo (texto + lâmina) em blocos. A migration 0003 faz o mesmo no banco;
// isto cobre o grafo vindo de um editor aberto antes da atualização e o seed.
export function blocksFromLegacy(input: { body?: LocalizedText; imageMediaId?: string | null }, newId: () => string): SceneBlock[] {
  const blocks: SceneBlock[] = [];
  if (input.imageMediaId) blocks.push({ id: newId(), type: "image", mediaId: input.imageMediaId, alt: {}, aspect: "auto", bleed: true });
  if (input.body && Object.values(input.body).some((value) => value.trim())) blocks.push({ id: newId(), type: "text", text: input.body });
  return blocks;
}
