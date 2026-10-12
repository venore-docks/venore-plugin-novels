import type { OperationResult } from "@venore/plugin-sdk";
import type { WorkPackage } from "../../../contracts/work-package";

// Exportar obra (0.15.0): a obra inteira no formato de pacote (contracts/work-package.ts), para
// importar em outra instalação ou guardar uma cópia. Sem imagens (o id de mídia é da instalação).
export type ExportWorkInput = { workId: string };
export type ExportWorkResult = OperationResult<{ fileName: string; pkg: WorkPackage }>;
