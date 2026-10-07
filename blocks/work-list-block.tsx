import type { BlockRendererProps } from "@venore/plugin-sdk";
import { listPublishedWorksHandler as listPublishedWorks } from "../features/reading/list-published-works/handler";
import { WorkCardGrid } from "../components/work-card-grid";

function readString(data: Record<string, unknown>, key: string, fallback: string): string {
  const value = data[key];
  return typeof value === "string" && value.trim() ? value : fallback;
}

export async function WorkListBlock({ block }: BlockRendererProps) {
  const data = block.data;
  const limit = typeof data.limit === "number" && data.limit > 0 ? data.limit : 8;
  const result = await listPublishedWorks({ limit });
  const works = result.success ? result.data.works : [];
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold text-foreground">{readString(data, "title", "Graphic novels")}</h2>
      {works.length === 0 ? (
        <p className="text-sm text-muted-foreground">{readString(data, "emptyMessage", "Nenhuma obra publicada ainda.")}</p>
      ) : (
        <WorkCardGrid works={works} badges={result.success ? result.data.badges : { interactive: {}, textOnly: {}, aiAudio: {} }} />
      )}
    </section>
  );
}
