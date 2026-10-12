// Esqueleto de pacote de obra a partir de um modelo de sistema embutido (sistema, variáveis,
// itens e criaturas já no formato do pacote, referenciados pela chave). Uso:
//   npx tsx scripts/template-skeleton.ts <aventura_simples|rpg_fantasia|venore_padrao|tibia_like|terror_sanidade|narrative> <saida.json>
import { writeFileSync } from "node:fs";
import { WORK_PACKAGE_FORMAT, type WorkPackage } from "../contracts/work-package";
import { BUILT_IN_TEMPLATES, builtInTemplate } from "../shared/templates/built-in";

const [key, out] = process.argv.slice(2);
if (!key || !out) {
  console.error(`uso: template-skeleton.ts <${[...BUILT_IN_TEMPLATES.map((template) => template.key), "narrative"].join("|")}> <saida.json>`);
  process.exit(2);
}
const template = key === "narrative" ? null : builtInTemplate(key);
if (key !== "narrative" && !template) {
  console.error(`modelo "${key}" não existe`);
  process.exit(2);
}
const strip = <T extends { id: string; position: number }>({ id: _id, position: _position, ...rest }: T) => {
  void _id;
  void _position;
  return { ...rest, imageMediaId: null };
};
const pkg: WorkPackage = {
  format: WORK_PACKAGE_FORMAT,
  version: 1,
  kind: key,
  work: { slug: "nova-obra", title: { "pt-BR": "Nova obra" }, subtitle: {}, synopsis: {}, defaultLocale: "pt-BR", locales: ["pt-BR"], tags: [] },
  variables: template?.variables ?? [],
  system: template?.system ?? null,
  cast: [],
  items: (template?.items ?? []).map(strip),
  creatures: (template?.creatures ?? []).map(strip),
  chapters: [],
};
writeFileSync(out, `${JSON.stringify(pkg, null, 2)}\n`);
console.log(`esqueleto de ${key} em ${out}`);
