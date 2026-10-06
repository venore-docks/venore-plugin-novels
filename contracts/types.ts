// Texto traduzível: um valor por locale ("pt-BR", "en", "es"...). O core não tem i18n
// (AGENTS.md, Known Gaps), então as traduções de cada obra moram no próprio plugin. A interface
// continua em pt-BR; só o conteúdo da obra é multilíngue.
export type LocalizedText = Record<string, string>;

export const WORK_STATUSES = ["draft", "in_review", "published", "rejected"] as const;
export type WorkStatus = (typeof WORK_STATUSES)[number];

export type VariableType = "number" | "boolean";
export type VariableValue = number | boolean;

// Variável de estado da obra ("coragem", "pegou_a_chave"). Escolhas e cenas leem/alteram esses
// valores; a condição de uma escolha decide se ela aparece pro leitor.
export type VariableDefinition = {
  key: string;
  label: string;
  type: VariableType;
  initial: VariableValue;
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

export type WorkRecord = {
  id: string;
  slug: string;
  title: LocalizedText;
  synopsis: LocalizedText;
  defaultLocale: string;
  locales: string[];
  coverMediaId: string | null;
  variables: VariableDefinition[];
  status: WorkStatus;
  authorUserId: string | null;
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
  imageMediaId: string | null;
  body: LocalizedText;
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

// A obra inteira, pronta pro leitor (ou pro validador de publicação). imageUrl já resolvida.
export type StoryScene = ChapterGraphScene & { chapterId: string; imageUrl: string | null };
export type StoryChapter = { id: string; position: number; title: LocalizedText; startSceneId: string | null };
export type Story = {
  work: {
    id: string;
    slug: string;
    title: LocalizedText;
    synopsis: LocalizedText;
    defaultLocale: string;
    locales: string[];
    coverUrl: string | null;
    variables: VariableDefinition[];
  };
  chapters: StoryChapter[];
  scenes: StoryScene[];
  choices: ChoiceRecord[];
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
