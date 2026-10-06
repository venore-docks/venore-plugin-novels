import { asPluginMetadata, asPluginPage, type PluginRouteTable } from "@venore/plugin-sdk";
import AdminPage from "./admin/page";
import AdminChapterPage from "./admin-chapter/page";
import AdminWorkPage from "./admin-work/page";
import CatalogPage from "./catalog/page";
import ReaderPage, { generateStoryMetadata } from "./reader/page";

export const novelsRouteTable: PluginRouteTable = {
  admin: [
    { pattern: "", Component: asPluginPage(AdminPage) },
    { pattern: "works/:workId", Component: asPluginPage(AdminWorkPage) },
    { pattern: "works/:workId/chapters/:chapterId", Component: asPluginPage(AdminChapterPage) },
  ],
  public: [
    { pattern: "novels", Component: asPluginPage(CatalogPage) },
    {
      pattern: "novels/:workSlug",
      Component: asPluginPage(ReaderPage),
      generateMetadata: asPluginMetadata(generateStoryMetadata),
    },
  ],
};
