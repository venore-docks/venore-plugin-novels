import type { PluginManifest } from "@venore/plugin-sdk";

// Faixa escrita à mão, não importada de platform/plugin-engine/core-version.ts: importar o
// CORE_VERSION corrente tornaria a checagem de compatibilidade sempre trivialmente satisfeita.
export const novelsManifest: PluginManifest = {
  manifestVersion: "1.0.0",
  key: "novels",
  name: "Graphic Novels",
  version: "0.6.0",
  description: "Graphic novels interativas: leitura webtoon, escolhas ramificadas com variáveis e editor em grafo.",
  compatibility: { coreVersion: ">=2.3.0 <3.0.0" },
  // Schema próprio (novels), aplicado no install; default de migrationsSchema
  // ("novels_migrations") bate com drizzle.config.ts.
  migrationsPath: "./migrations",
  permissions: [{ key: "novels.works.manage", label: "Criar, editar e publicar graphic novels" }],
  navigation: [
    {
      key: "novels.works",
      label: "Graphic Novels",
      href: "/admin/novels",
      icon: "book-open",
      groupKey: "plugins",
      groupLabel: "Plugins",
      groupOrder: 30,
      order: 40,
      requiredPermission: "novels.works.manage",
    },
  ],
  seeds: [
    {
      key: "example",
      label: "Obra de exemplo",
      description: "\"O Farol\": dois capítulos, escolhas com variável e quatro finais, em português e inglês (sem imagens).",
    },
  ],
  blocks: [{ key: "novels.work.list", label: "Graphic Novels — Vitrine de obras" }],
};
