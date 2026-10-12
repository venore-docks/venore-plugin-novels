import { sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@venore/plugin-sdk";
import { works } from "../../../database/schema";
import { WORK_EXAMPLE_KEYS } from "../../../examples";
import { planWorkImport } from "../../../shared/work-package";
import { exportWork } from "../export-work/service";
import { getWork } from "../get-work/service";
import { publishWork } from "../../publishing/publish-work/service";
import { importWork } from "./service";

const t = (text: string) => ({ "pt-BR": text });
const pkg = {
  format: "venore-novels-work",
  version: 1,
  work: { slug: "ponte", title: t("A Ponte"), tags: ["terror", "nao-existe"] },
  cast: [{ key: "guia", name: t("Guia") }],
  chapters: [
    {
      key: "cap1",
      title: t("A ponte"),
      start: "beira",
      scenes: [
        { key: "beira", label: "Beira", blocks: [{ type: "speech", castId: "guia", text: t("Segure firme.") }] },
        { key: "fim", label: "Fim", text: t("Do outro lado."), isEnding: true, endingTitle: t("Travessia") },
      ],
      choices: [{ from: "beira", to: "fim", label: t("Atravessar") }],
    },
  ],
};

describe("novels — importar e exportar obra (integração)", () => {
  beforeEach(async () => {
    await db.execute(sql.raw("TRUNCATE TABLE novels.works CASCADE"));
  });

  it("importa como rascunho, repete com sufixo no endereço e exporta de volta", async () => {
    const first = await importWork({ source: { kind: "file", content: JSON.stringify(pkg) }, actorId: "u" });
    if (!first.success) throw new Error(first.error.message);
    expect(first.data).toMatchObject({ slug: "ponte", chapters: 1, scenes: 2, errors: 0 });
    const second = await importWork({ source: { kind: "file", content: JSON.stringify(pkg) }, actorId: "u" });
    expect(second.success && second.data.slug).toBe("ponte-2");

    const view = await getWork({ workId: first.data.workId });
    if (!view.success) throw new Error("getWork");
    expect(view.data.work.status).toBe("draft");
    expect(view.data.cast.map((member) => member.name["pt-BR"])).toEqual(["Guia"]);
    expect((await publishWork({ workId: first.data.workId, actorId: "u" })).success).toBe(true);

    const exported = await exportWork({ workId: first.data.workId });
    if (!exported.success) throw new Error("export");
    expect(exported.data.fileName).toBe("ponte.venore-novel.json");
    expect(exported.data.pkg.chapters[0].scenes[0].blocks?.[0]).toMatchObject({ type: "speech", castId: "guia" });
    expect(planWorkImport(exported.data.pkg, () => crypto.randomUUID()).ok).toBe(true);
  });

  it("recusa pacote quebrado sem gravar nada", async () => {
    const broken = { ...pkg, chapters: [{ ...pkg.chapters[0], start: "nao-existe" }] };
    const result = await importWork({ source: { kind: "file", content: JSON.stringify(broken) }, actorId: "u" });
    expect(result).toMatchObject({ success: false, error: { code: "novels.invalid_package" } });
    expect(await db.select({ id: works.id }).from(works)).toEqual([]);
  });

  it("cada história de exemplo entra sem erro de validação", async () => {
    for (const key of WORK_EXAMPLE_KEYS) {
      const result = await importWork({ source: { kind: "example", key }, actorId: "u" });
      if (!result.success) throw new Error(`${key}: ${result.error.message}`);
      expect({ key, errors: result.data.errors, first: result.data.firstIssues }).toMatchObject({ key, errors: 0 });
    }
  });
});
