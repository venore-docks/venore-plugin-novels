import { loadWorkExample, WORK_EXAMPLE_KEYS, type WorkExampleKey } from "../../../examples";

export async function findExamplePackages(): Promise<{ key: WorkExampleKey; pkg: unknown }[]> {
  return Promise.all(WORK_EXAMPLE_KEYS.map(async (key) => ({ key, pkg: await loadWorkExample(key) })));
}
