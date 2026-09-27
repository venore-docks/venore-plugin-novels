import type { BlockDefinition } from "@venore/plugin-sdk/cms";

export const workListBlockDefinition: BlockDefinition = {
  key: "graphic-novels.work.list",
  label: "Graphic Novels — Vitrine de obras",
  category: "graphic-novels",
  structure: "leaf",
  allowedInRoot: true,
  defaultData: {
    title: "Graphic novels",
    emptyMessage: "Nenhuma obra publicada ainda.",
    limit: 8,
  },
  editorFields: [
    { name: "title", type: "text", label: "Título" },
    { name: "emptyMessage", type: "text", label: "Mensagem quando não há obras" },
    { name: "limit", type: "number", label: "Quantidade máxima exibida" },
  ],
};
