import type { CatalogBadges, LocalizedText, TagCategory, TagSelection } from "../contracts/types";

// Pacote inicial do catálogo de tags: as listas fixas da 0.8.0 viraram dado. A migration 0003
// instala uma cópia congelada deste pacote (e converte as tags das obras antigas); o botão
// "Instalar pacote inicial" do admin usa esta lista para repor o que o admin apagou (só insere o
// que falta, por key do grupo e slug da tag).

export type StarterTag = { slug: string; name: LocalizedText; description?: LocalizedText };
export type StarterGroup = {
  key: string;
  name: LocalizedText;
  category: TagCategory;
  selection: TagSelection;
  required: boolean;
  allowCustom: boolean;
  showOnCard: boolean;
  tags: StarterTag[];
};

const t = (pt: string, en: string): LocalizedText => ({ "pt-BR": pt, en });
const assisted: LocalizedText = t(
  "Feito por pessoas usando IA como ferramenta (sugestões, rascunhos, correções).",
  "Made by people using AI as a tool (suggestions, drafts, corrections).",
);

function production(key: string, prefix: string, name: LocalizedText): StarterGroup {
  return {
    key,
    name,
    category: "production",
    selection: "single",
    required: false,
    allowCustom: false,
    showOnCard: false,
    tags: [
      { slug: `${prefix}-humanos`, name: t("Feito por humanos", "Made by humans") },
      { slug: `${prefix}-ia`, name: t("Feito por IA", "Made by AI") },
      { slug: `${prefix}-auxilio-ia`, name: t("Humanos com auxílio de IA", "Humans assisted by AI"), description: assisted },
    ],
  };
}

export const TAG_STARTER_PACK: StarterGroup[] = [
  {
    key: "genero",
    name: t("Gênero", "Genre"),
    category: "info",
    selection: "multiple",
    required: false,
    allowCustom: true,
    showOnCard: true,
    tags: [
      { slug: "aventura", name: t("Aventura", "Adventure") },
      { slug: "acao", name: t("Ação", "Action") },
      { slug: "fantasia", name: t("Fantasia", "Fantasy") },
      { slug: "ficcao-cientifica", name: t("Ficção científica", "Science fiction") },
      { slug: "terror", name: t("Terror", "Horror") },
      { slug: "suspense", name: t("Suspense", "Thriller") },
      { slug: "misterio", name: t("Mistério", "Mystery") },
      { slug: "romance", name: t("Romance", "Romance") },
      { slug: "drama", name: t("Drama", "Drama") },
      { slug: "comedia", name: t("Comédia", "Comedy") },
      { slug: "historico", name: t("Histórico", "Historical") },
      { slug: "cotidiano", name: t("Cotidiano", "Slice of life") },
      { slug: "rpg", name: t("RPG", "RPG") },
      { slug: "fanfic", name: t("Fanfic", "Fan fiction") },
    ],
  },
  {
    key: "classificacao",
    name: t("Classificação indicativa", "Age rating"),
    category: "info",
    selection: "single",
    required: false,
    allowCustom: false,
    showOnCard: true,
    tags: [
      { slug: "livre", name: t("Livre", "All ages") },
      { slug: "10-anos", name: t("10+", "10+") },
      { slug: "12-anos", name: t("12+", "12+") },
      { slug: "14-anos", name: t("14+", "14+") },
      { slug: "16-anos", name: t("16+", "16+") },
      { slug: "18-anos", name: t("18+", "18+") },
    ],
  },
  {
    key: "conteudo",
    name: t("Avisos de conteúdo", "Content warnings"),
    category: "info",
    selection: "multiple",
    required: false,
    allowCustom: false,
    showOnCard: false,
    tags: [
      { slug: "violencia", name: t("Violência", "Violence") },
      { slug: "sangue", name: t("Sangue e gore", "Blood and gore") },
      { slug: "sexual", name: t("Conteúdo sexual", "Sexual content") },
      { slug: "nudez", name: t("Nudez", "Nudity") },
      { slug: "linguagem", name: t("Linguagem forte", "Strong language") },
      { slug: "drogas", name: t("Álcool e drogas", "Alcohol and drugs") },
      { slug: "suicidio", name: t("Suicídio e automutilação", "Suicide and self-harm") },
      { slug: "abuso", name: t("Abuso", "Abuse") },
      { slug: "morte", name: t("Morte", "Death") },
      { slug: "discriminacao", name: t("Discriminação", "Discrimination") },
    ],
  },
  production("producao-texto", "texto", t("Texto", "Text")),
  production("producao-imagens", "imagens", t("Imagens", "Images")),
  production("producao-revisao", "revisao", t("Revisão", "Review")),
  production("producao-traducao", "traducao", t("Tradução", "Translation")),
];

export const DEFAULT_BADGES: CatalogBadges = {
  interactive: t("Interativa", "Interactive"),
  textOnly: t("Apenas texto", "Text only"),
  aiAudio: t("Áudio gerado por IA", "AI-generated audio"),
};
