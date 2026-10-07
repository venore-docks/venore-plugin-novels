import type { AccentColor } from "../contracts/types";

// Cor de destaque -> classes de token do tema. Strings literais de propósito: o Tailwind só gera
// a classe que aparece escrita no código.
export const ACCENT_CLASSES: Record<AccentColor, { text: string; border: string; soft: string; solid: string; label: string }> = {
  primary: { text: "text-primary", border: "border-primary", soft: "bg-primary/10", solid: "bg-primary", label: "Cor 1" },
  "chart-2": { text: "text-chart-2", border: "border-chart-2", soft: "bg-chart-2/10", solid: "bg-chart-2", label: "Cor 2" },
  "chart-4": { text: "text-chart-4", border: "border-chart-4", soft: "bg-chart-4/10", solid: "bg-chart-4", label: "Cor 3" },
  "chart-5": { text: "text-chart-5", border: "border-chart-5", soft: "bg-chart-5/10", solid: "bg-chart-5", label: "Cor 4" },
  "chart-6": { text: "text-chart-6", border: "border-chart-6", soft: "bg-chart-6/10", solid: "bg-chart-6", label: "Cor 5" },
  "chart-7": { text: "text-chart-7", border: "border-chart-7", soft: "bg-chart-7/10", solid: "bg-chart-7", label: "Cor 6" },
  muted: { text: "text-muted-foreground", border: "border-ring", soft: "bg-muted", solid: "bg-muted-foreground", label: "Neutra" },
};

export function accentOf(color: string | null | undefined) {
  return ACCENT_CLASSES[(color ?? "primary") as AccentColor] ?? ACCENT_CLASSES.primary;
}
