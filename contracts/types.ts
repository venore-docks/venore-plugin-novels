// Texto traduzível: um valor por locale ("pt-BR", "en", "es"...). O core não tem i18n
// (AGENTS.md, Known Gaps), então as traduções de cada obra moram no próprio plugin. A interface
// continua em pt-BR; só o conteúdo da obra (e do catálogo de tags) é multilíngue.
export type LocalizedText = Record<string, string>;

export const WORK_STATUSES = ["draft", "in_review", "published", "rejected"] as const;
export type WorkStatus = (typeof WORK_STATUSES)[number];

export type VariableType = "number" | "boolean";
export type VariableValue = number | boolean;

// Onde a variável aparece para o leitor (painel do personagem): "hidden" (padrão, só o motor usa),
// "status" (HP, mana, nível — com barra quando tem máximo), "skill" (club fighting, fist
// fighting) ou "inventory" (item: sim/não = carrega ou não; número = quantidade).
export const VARIABLE_DISPLAYS = ["hidden", "status", "skill", "inventory"] as const;
export type VariableDisplay = (typeof VARIABLE_DISPLAYS)[number];

// Variável de estado da obra ("coragem", "pegou_a_chave"). Escolhas e cenas leem/alteram esses
// valores; a condição de uma escolha decide se ela aparece pro leitor. Os campos opcionais (0.7.0)
// cuidam de exibição e limites; obra antiga sem eles continua igual.
export type VariableDefinition = {
  key: string;
  label: string;
  type: VariableType;
  initial: VariableValue;
  display?: VariableDisplay;
  // Número: limites aplicados depois de cada efeito (HP nunca abaixo de 0 nem acima do máximo).
  // `maxVariable` usa outra variável como teto (hp_max que sobe de nível) e vale no lugar de `max`.
  min?: number;
  max?: number;
  maxVariable?: string;
  // Item de inventário: peso de uma unidade (padrão 1). A soma vira a carga.
  weight?: number;
  // Número que guarda a capacidade de carga (cap). No máximo uma por obra.
  capacity?: boolean;
};

export const CONDITION_OPERATORS = ["eq", "neq", "gt", "gte", "lt", "lte"] as const;
export type ConditionOperator = (typeof CONDITION_OPERATORS)[number];

export type ChoiceCondition = {
  variable: string;
  operator: ConditionOperator;
  value: VariableValue;
};

export const EFFECT_OPERATIONS = ["set", "add", "toggle"] as const;
export type EffectOperation = (typeof EFFECT_OPERATIONS)[number];

export type VariableEffect = {
  variable: string;
  operation: EffectOperation;
  value: VariableValue;
};

// ------------------------------------------------------------------ catálogo de tags (0.9.0)
// Tags são dados cadastrados no admin (Graphic Novels → Tags), em grupos. O código só conhece a
// forma do grupo (categoria, uma ou várias, obrigatório, aceita tag livre), nunca um gênero ou uma
// origem de produção.

export const TAG_CATEGORIES = ["info", "production"] as const;
export type TagCategory = (typeof TAG_CATEGORIES)[number];
export const TAG_SELECTIONS = ["single", "multiple"] as const;
export type TagSelection = (typeof TAG_SELECTIONS)[number];

export type TagGroupRecord = {
  id: string;
  key: string;
  name: LocalizedText;
  category: TagCategory;
  selection: TagSelection;
  required: boolean;
  allowCustom: boolean;
  showOnCard: boolean;
  position: number;
  archivedAt: Date | null;
};

// `custom`: tag livre criada por um autor ao escolher (grupo com "aceita tag livre"). Só aparece
// na obra que a usa até o admin promover ao catálogo.
export type TagRecord = {
  id: string;
  groupId: string;
  slug: string;
  name: LocalizedText;
  description: LocalizedText;
  position: number;
  custom: boolean;
  archivedAt: Date | null;
};

// Textos dos selos calculados (o autor não escolhe): formato da obra e áudio gerado. Ficam em
// configuração (novels.catalog_settings), não no código.
export type CatalogBadges = { interactive: LocalizedText; textOnly: LocalizedText; aiAudio: LocalizedText };

export type TagCatalog = { groups: TagGroupRecord[]; tags: TagRecord[]; badges: CatalogBadges };

// O que o formulário da obra manda: tags existentes e tags livres novas (nome digitado num grupo
// que aceita tag livre).
export type WorkTagInput = { tagIds: string[]; newTags: { groupId: string; name: string }[] };

// Tags da obra prontas para mostrar (leitor e catálogo), em grupos, na ordem do catálogo.
export type WorkTagGroupView = {
  id: string;
  key: string;
  name: LocalizedText;
  category: TagCategory;
  showOnCard: boolean;
  tags: { id: string; slug: string; name: LocalizedText; description: LocalizedText }[];
};

// ------------------------------------------------------------------ cena em blocos (0.9.0)

export const IMAGE_ASPECTS = ["auto", "16:9", "4:3", "1:1", "3:4", "2:3"] as const;
export type ImageAspect = (typeof IMAGE_ASPECTS)[number];
export const DIVIDER_STYLES = ["line", "dots", "space"] as const;
export type DividerStyle = (typeof DIVIDER_STYLES)[number];
export const CAPTION_MAX_CHARS = 180;

// Texto continua texto em todo bloco (legenda, fala, texto sobre a imagem esmaecida): entra na
// tradução, na leitura em voz alta e no leitor de tela. Nunca "pintado" na imagem.
export type SceneBlock =
  | { id: string; type: "text"; text: LocalizedText }
  | { id: string; type: "image"; mediaId: string | null; alt: LocalizedText; aspect: ImageAspect; bleed: boolean }
  | { id: string; type: "caption"; mediaId: string | null; alt: LocalizedText; caption: LocalizedText; position: "top" | "bottom" }
  | { id: string; type: "speech"; castId: string | null; text: LocalizedText }
  | { id: string; type: "gallery"; images: { mediaId: string; alt: LocalizedText }[] }
  | { id: string; type: "divider"; style: DividerStyle }
  | { id: string; type: "backdrop"; mediaId: string | null; alt: LocalizedText; text: LocalizedText };

export type SceneBlockType = SceneBlock["type"];
export const SCENE_BLOCK_TYPES: SceneBlockType[] = ["text", "image", "caption", "speech", "gallery", "divider", "backdrop"];

// Cores de destaque (elenco, recursos, raridade): lista fechada de tokens do tema, nunca hex.
export const ACCENT_COLORS = ["primary", "chart-2", "chart-4", "chart-5", "chart-6", "chart-7", "muted"] as const;
export type AccentColor = (typeof ACCENT_COLORS)[number];

// Elenco da obra: quem fala nos blocos "Fala".
export type CastMemberRecord = {
  id: string;
  workId: string;
  name: LocalizedText;
  color: AccentColor;
  portraitMediaId: string | null;
  position: number;
};
export type CastMember = Omit<CastMemberRecord, "workId">;

// ------------------------------------------------------------------ obra

// Ponto da capa que fica visível no recorte 2:3 (porcentagem, 0 a 100).
export type CoverFocus = { x: number; y: number };

export type WorkRecord = {
  id: string;
  slug: string;
  title: LocalizedText;
  subtitle: LocalizedText;
  synopsis: LocalizedText;
  defaultLocale: string;
  locales: string[];
  coverMediaId: string | null;
  coverFocus: CoverFocus | null;
  variables: VariableDefinition[];
  status: WorkStatus;
  authorUserId: string | null;
  speechEnabled: boolean;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ChapterRecord = {
  id: string;
  workId: string;
  position: number;
  title: LocalizedText;
  startSceneId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type SceneRecord = {
  id: string;
  workId: string;
  chapterId: string;
  label: string;
  blocks: SceneBlock[];
  isEnding: boolean;
  endingTitle: LocalizedText;
  effects: VariableEffect[];
  graphX: number;
  graphY: number;
};

export type ChoiceRecord = {
  id: string;
  sceneId: string;
  targetSceneId: string;
  position: number;
  label: LocalizedText;
  conditions: ChoiceCondition[];
  effects: VariableEffect[];
};

// Grafo de um capítulo como o editor manipula: cenas + escolhas, salvo inteiro de uma vez
// (features/graph/save-chapter-graph). Ids são gerados no client (crypto.randomUUID).
export type ChapterGraphScene = Omit<SceneRecord, "workId" | "chapterId">;
export type ChapterGraphChoice = ChoiceRecord;
export type ChapterGraph = {
  startSceneId: string | null;
  scenes: ChapterGraphScene[];
  choices: ChapterGraphChoice[];
};

// A obra inteira, pronta pro leitor (ou pro validador de publicação). Mídia resolvida em
// `media` (id -> URL), usada por blocos, elenco e capa.
export type StoryScene = ChapterGraphScene & { chapterId: string };
export type StoryChapter = { id: string; position: number; title: LocalizedText; startSceneId: string | null };
export type Story = {
  work: {
    id: string;
    slug: string;
    title: LocalizedText;
    subtitle: LocalizedText;
    synopsis: LocalizedText;
    defaultLocale: string;
    locales: string[];
    coverUrl: string | null;
    coverFocus: CoverFocus | null;
    variables: VariableDefinition[];
    tags: WorkTagGroupView[];
  };
  badges: CatalogBadges;
  chapters: StoryChapter[];
  scenes: StoryScene[];
  choices: ChoiceRecord[];
  cast: CastMember[];
  media: Record<string, string>;
  // Leitura em voz alta: sceneId -> locale -> URL do MP3 já gerado. Cena/idioma sem entrada não
  // tem áudio (ainda na fila, sem tradução ou leitura desligada).
  audio: Record<string, Record<string, string>>;
};

// Estado de leitura de uma obra. `path` é a sequência de cenas visitadas (o feed vertical do
// leitor), `visitedEndings` acumula os finais já alcançados entre partidas.
export type ReaderState = {
  sceneId: string;
  vars: Record<string, VariableValue>;
  path: string[];
  visitedEndings: string[];
};
