// Histórias de exemplo, uma por tipo de obra (examples/README.md), oferecidas na tela de
// importação. Carregadas sob demanda: o JSON só entra no servidor quando alguém importa.
export const WORK_EXAMPLE_KEYS = ["narrative", "aventura_simples", "rpg_fantasia", "venore_padrao", "tibia_like", "terror_sanidade"] as const;
export type WorkExampleKey = (typeof WORK_EXAMPLE_KEYS)[number];

export function isWorkExampleKey(value: string): value is WorkExampleKey {
  return (WORK_EXAMPLE_KEYS as readonly string[]).includes(value);
}

export async function loadWorkExample(key: WorkExampleKey): Promise<unknown> {
  switch (key) {
    case "narrative":
      return (await import("./narrative.json")).default as unknown;
    case "aventura_simples":
      return (await import("./aventura_simples.json")).default as unknown;
    case "rpg_fantasia":
      return (await import("./rpg_fantasia.json")).default as unknown;
    case "venore_padrao":
      return (await import("./venore_padrao.json")).default as unknown;
    case "tibia_like":
      return (await import("./tibia_like.json")).default as unknown;
    case "terror_sanidade":
      return (await import("./terror_sanidade.json")).default as unknown;
  }
}
