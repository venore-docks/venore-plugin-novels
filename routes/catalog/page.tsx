import { notFound } from "next/navigation";
import { isPluginActive } from "@venore/plugin-sdk";
import { listPublishedWorks } from "../../index";
import { WorkCardGrid } from "../../components/work-card-grid";
import { PLUGIN_KEY } from "../../shared/constants";

export default async function NovelsCatalogPage() {
  if (!(await isPluginActive(PLUGIN_KEY))) notFound();
  const result = await listPublishedWorks({});
  const works = result.success ? result.data : [];

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8">
      <h1 className="text-2xl font-semibold text-foreground">Graphic novels</h1>
      {works.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma obra publicada ainda.</p>
      ) : (
        <WorkCardGrid works={works} />
      )}
    </div>
  );
}
