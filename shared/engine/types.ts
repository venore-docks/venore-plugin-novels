import type { LocalizedText, VariableValue } from "../../contracts/types";

// Estado de uma partida (0.10.0). A partida é o registro de ações (`log`) a partir de uma semente:
// o estado é sempre o resultado de refazer as ações, então voltar uma escolha, recarregar a
// página ou conferir no servidor dão o mesmo resultado (dado incluso).

export type PlayAction =
  | {
      t: "start";
      profile?: Record<string, string>;
      vocationId?: string | null;
      allocations?: Record<string, number>;
      hardcore?: boolean;
      carry?: Record<string, VariableValue>;
    }
  | { t: "choose"; choiceId: string }
  | { t: "continue" }
  | { t: "reroll" }
  | { t: "equip"; itemId: string }
  | { t: "unequip"; itemId: string }
  | { t: "use"; itemId: string }
  | { t: "drop"; itemId: string; quantity: number }
  | { t: "pickup"; itemId: string }
  | { t: "discard" }
  | { t: "allocate"; key: string }
  | { t: "combat"; action: string; target?: number; itemId?: string }
  | { t: "buy"; itemId: string }
  | { t: "sell"; itemId: string };

// O que vai para o navegador e para a conta. `achievements` e `visitedEndings` atravessam
// partidas (recomeçar não apaga).
export type SavedGame = {
  v: 2;
  seed: string;
  log: PlayAction[];
  visitedEndings: string[];
  achievements: string[];
};

export type Stack = { itemId: string; quantity: number };

export type Change =
  | { type: "value"; key: string; label: LocalizedText; delta: number; detail?: string }
  | { type: "flag"; key: string; label: LocalizedText; value: boolean }
  | { type: "item"; key: string; label: LocalizedText; delta: number }
  | { type: "level"; key: string; label: LocalizedText; value: number }
  | { type: "status"; key: string; label: LocalizedText; on: boolean }
  | { type: "quest"; key: string; label: LocalizedText; state: "active" | "done" | "failed" | "step" }
  | { type: "achievement"; key: string; label: LocalizedText }
  | { type: "overflow"; key: string; label: LocalizedText; quantity: number };

export type RollView = {
  label: LocalizedText;
  notation: string;
  dice: { sides: number; rolls: number[]; kept: number[] }[];
  total: number;
  dc: number | null;
  outcome: "success" | "failure" | "critical" | "fumble" | "band" | null;
};

export type CombatLogLine = {
  round: number;
  kind: "attack" | "miss" | "defend" | "flee" | "flee-fail" | "item" | "heal" | "enemy-flee" | "victory" | "defeat" | "single";
  actor: LocalizedText;
  target: LocalizedText | null;
  amount: number | null;
  action: LocalizedText | null;
  roll: RollView | null;
};

export type SceneEntry = {
  sceneId: string;
  changes: Change[];
  rolls: RollView[];
  combat: CombatLogLine[];
};

export type CombatantState = { creatureId: string; hp: number; maxHp: number; healed: boolean; fled: boolean };

export type CombatState = {
  sceneId: string;
  creatures: CombatantState[];
  round: number;
  defending: boolean;
  result: null | "victory" | "defeat" | "fled";
};

export type QuestState = { state: "active" | "done" | "failed"; step: number };

// Para "rolar de novo": como estava antes do último teste e quantas rolagens ele gastou.
export type RerollBase = { state: GameState; choiceId: string; rolls: number };

export type GameState = {
  started: boolean;
  sceneId: string;
  path: string[];
  entries: SceneEntry[];
  vars: Record<string, VariableValue>;
  visitedEndings: string[];
  achievements: string[];
  bag: Stack[];
  equipped: Record<string, string[]>;
  overflow: Stack[];
  ground: Stack[];
  effects: { id: string; remaining: number | null }[];
  quests: Record<string, QuestState>;
  training: Record<string, number>;
  profile: Record<string, string>;
  vocationId: string | null;
  combat: CombatState | null;
  shopStock: Record<string, Record<string, number>>;
  seenCreatures: string[];
  hardcore: boolean;
  // Estado de cada recurso no último gatilho ("zero", "full" ou ""): o gatilho só dispara na
  // passagem, não a cada ação enquanto o recurso continua zerado.
  triggers: Record<string, string>;
  // Último nível já contado (pontos e efeitos de subir de nível aplicados até ele).
  level: number;
  seed: string;
  counter: number;
  log: PlayAction[];
  // Só em memória (refeito no replay): permite "rolar de novo" logo depois de um teste.
  rerollBase: RerollBase | null;
};

export type ActionResult = { ok: true; state: GameState } | { ok: false; reason: string };
