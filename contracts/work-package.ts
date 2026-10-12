import type { ChoiceMechanics, Condition, Creature, Effect, GameSystem, Item, SceneMechanics } from "./game";
import type { AccentColor, LocalizedText, SceneBlock, VariableDefinition } from "./types";

// Pacote de obra (0.15.0): uma história inteira num arquivo JSON, para importar em qualquer
// instalação ou guardar fora do banco. Dentro do pacote tudo é referenciado por chave legível,
// nunca por id do banco: cena pela `key` da cena (única na obra), item e criatura pela `key` do
// catálogo, personagem do elenco pela `key` dele. Imagens não viajam (o id de mídia é da
// instalação): o leitor mostra o cartão com o nome no lugar.
export const WORK_PACKAGE_FORMAT = "venore-novels-work";

export type PackageBlock = (
  | Omit<Extract<SceneBlock, { type: "text" }>, "id">
  | Omit<Extract<SceneBlock, { type: "speech" }>, "id">
  | Omit<Extract<SceneBlock, { type: "divider" }>, "id">
  | Omit<Extract<SceneBlock, { type: "image" }>, "id">
  | Omit<Extract<SceneBlock, { type: "caption" }>, "id">
  | Omit<Extract<SceneBlock, { type: "backdrop" }>, "id">
) & { id?: string };

export type PackageScene = {
  key: string;
  // Nome só para o autor (grafo).
  label?: string;
  // Atalho: um bloco de texto. Junto com `blocks`, vem antes deles.
  text?: LocalizedText;
  blocks?: PackageBlock[];
  isEnding?: boolean;
  endingTitle?: LocalizedText;
  effects?: Effect[];
  mechanics?: Partial<SceneMechanics>;
  // Posição no grafo; sem ela, o importador distribui em camadas a partir da cena inicial.
  x?: number;
  y?: number;
};

export type PackageChoice = {
  // Chaves de cena do mesmo capítulo.
  from: string;
  to: string;
  label: LocalizedText;
  conditions?: Condition[];
  effects?: Effect[];
  mechanics?: Partial<ChoiceMechanics>;
};

export type PackageChapter = {
  key: string;
  title: LocalizedText;
  start: string;
  scenes: PackageScene[];
  choices: PackageChoice[];
};

export type WorkPackage = {
  format: typeof WORK_PACKAGE_FORMAT;
  version: 1;
  // "narrative" ou a chave do modelo de sistema em que a obra se baseia (só informativo).
  kind?: string;
  work: {
    slug: string;
    title: LocalizedText;
    subtitle?: LocalizedText;
    synopsis?: LocalizedText;
    defaultLocale?: string;
    locales?: string[];
    // Slugs de tags do catálogo; as que não existirem na instalação são ignoradas.
    tags?: string[];
  };
  variables?: VariableDefinition[];
  system?: Partial<GameSystem> | null;
  cast?: { key: string; name: LocalizedText; color?: AccentColor }[];
  items?: (Omit<Item, "id" | "position" | "imageMediaId"> & { imageMediaId?: null })[];
  creatures?: (Omit<Creature, "id" | "position" | "imageMediaId"> & { imageMediaId?: null })[];
  chapters: PackageChapter[];
};
