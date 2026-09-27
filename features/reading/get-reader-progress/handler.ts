import { getCurrentUser } from "@venore/plugin-sdk/auth";
import { getReaderProgress } from "./service";
import type { GetReaderProgressInput, GetReaderProgressResult } from "./types";

// Login é opcional pra ler: sem sessão devolve null (não erro) e o leitor segue com o
// progresso local do navegador.
export async function getReaderProgressHandler(input: GetReaderProgressInput): Promise<GetReaderProgressResult> {
  const user = await getCurrentUser();
  if (!user.success || !user.data) return { success: true, data: null };
  return getReaderProgress({ workId: input.workId, userId: user.data.id });
}
