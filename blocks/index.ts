// definitions.ts é dado puro; renderers.ts puxa handler -> db. Separados pelo mesmo motivo do
// academy/birthdays: teste que só precisa do schema não arrasta banco.
export { blockDefinitions } from "./definitions";
export { blockRenderers } from "./renderers";
