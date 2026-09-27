import type { PluginManifest } from "@venore/plugin-sdk";

// Faixa escrita à mão, não importada de platform/plugin-engine/core-version.ts: importar o
// CORE_VERSION corrente tornaria a checagem de compatibilidade sempre trivialmente satisfeita.
export const graphicNovelsManifest: PluginManifest = {
  manifestVersion: "1.0.0",
  key: "graphic-novels",
  name: "Graphic Novels",
  version: "0.1.0",
  description: "Graphic novels interativas: leitura webtoon, escolhas ramificadas com variáveis e editor em grafo.",
  compatibility: { coreVersion: ">=2.0.0 <3.0.0" },
  // Schema próprio (graphic_novels), aplicado no install; default de migrationsSchema
  // ("graphic_novels_migrations") bate com drizzle.config.ts.
  migrationsPath: "./migrations",
  permissions: [{ key: "graphic-novels.works.manage", label: "Criar, editar e publicar graphic novels" }],
  navigation: [
    {
      key: "graphic-novels.works",
      label: "Graphic Novels",
      href: "/admin/graphic-novels",
      icon: "book-open",
      groupKey: "plugins",
      groupLabel: "Plugins",
      groupOrder: 30,
      order: 40,
      requiredPermission: "graphic-novels.works.manage",
    },
  ],
  seeds: [
    {
      key: "example",
      label: "Obra de exemplo",
      description: "\"O Farol\": dois capítulos, escolhas com variável e quatro finais, em português e inglês (sem imagens).",
    },
  ],
  blocks: [{ key: "graphic-novels.work.list", label: "Graphic Novels — Vitrine de obras" }],
};
