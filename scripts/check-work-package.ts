// Confere um pacote de obra (examples/*.json): formato, validador de publicação e o simulador
// jogando com cada estratégia. Uso (a partir do core, que tem tsx):
//   npx tsx ../venore-plugin-novels/scripts/check-work-package.ts ../venore-plugin-novels/examples/x.json [partidas]
import { readFileSync } from "node:fs";
import { storyForEngine } from "../shared/build-story";
import { createContext } from "../shared/engine/context";
import { SIM_STRATEGIES, simulateRuns } from "../shared/engine/simulate";
import { planWorkImport, recordsFromImported } from "../shared/work-package";

const [file, runsArg] = process.argv.slice(2);
if (!file) {
  console.error("uso: check-work-package.ts <arquivo.json> [partidas]");
  process.exit(2);
}
let counter = 0;
const plan = planWorkImport(readFileSync(file, "utf8"), () => `id${(counter += 1)}`);
if (!plan.ok) {
  console.log("PACOTE INVÁLIDO");
  for (const error of plan.errors) console.log(`  ✖ ${error}`);
  process.exit(1);
}
const imported = plan.value;
const scenes = imported.chapters.flatMap((chapter) => chapter.graph.scenes);
const label = new Map(scenes.map((scene) => [scene.id, scene.label]));
const words = scenes
  .flatMap((scene) => scene.blocks)
  .map((block) => ("text" in block ? (block.text[imported.work.defaultLocale] ?? "") : ""))
  .join(" ")
  .split(/\s+/)
  .filter(Boolean).length;
const choices = imported.chapters.reduce((sum, chapter) => sum + chapter.graph.choices.length, 0);
const on = Object.entries(imported.work.gameSystem.modules)
  .filter(([, enabled]) => enabled)
  .map(([module]) => module);
console.log(`${imported.work.title[imported.work.defaultLocale]} (${imported.kind ?? "sem tipo"})`);
console.log(`  ${imported.chapters.length} capítulos · ${scenes.length} cenas · ${choices} escolhas · ${scenes.filter((scene) => scene.isEnding).length} finais · ${words} palavras`);
console.log(`  módulos: ${on.join(", ") || "nenhum (só narrativa)"} · ${imported.items.length} itens · ${imported.creatures.length} criaturas · ${imported.cast.length} no elenco`);

const errors = plan.issues.filter((issue) => issue.severity === "error");
const warnings = plan.issues.filter((issue) => issue.severity === "warning");
console.log(`\nVALIDADOR: ${errors.length} erros, ${warnings.length} avisos`);
for (const issue of [...errors, ...warnings].slice(0, 60)) console.log(`  ${issue.severity === "error" ? "✖" : "!"} [${issue.code}] ${issue.message}`);

const ctx = createContext(storyForEngine(recordsFromImported(imported)));
const runs = Number(runsArg) || 300;
for (const strategy of SIM_STRATEGIES) {
  const summary = simulateRuns(ctx, runs, `check-${strategy}`, strategy);
  const pct = (count: number) => `${Math.round((count / summary.runs) * 100)}%`;
  const endings = [...summary.endings.entries()].sort((a, b) => b[1] - a[1]).map(([id, count]) => `${label.get(id)} ${pct(count)}`);
  const stuck = [...summary.stuck.entries()].map(([id, count]) => `${label.get(id)} ${pct(count)}`);
  const deaths = [...summary.deaths.entries()].map(([id, count]) => `${label.get(id)} ${pct(count)}`);
  const unreached = scenes.filter((scene) => !summary.visited.has(scene.id)).map((scene) => scene.label);
  console.log(`\nSIMULADOR ${strategy} (${summary.runs} partidas, ${summary.averageSteps} passos em média)`);
  console.log(`  finais: ${endings.join(" · ") || "nenhum"}`);
  if (stuck.length) console.log(`  empacou: ${stuck.join(" · ")}`);
  if (deaths.length) console.log(`  recurso zerou em: ${deaths.join(" · ")}`);
  console.log(`  nunca visitadas (${unreached.length}/${scenes.length}): ${unreached.join(", ") || "—"}`);
}
process.exit(errors.length > 0 ? 1 : 0);
