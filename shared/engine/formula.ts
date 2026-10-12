// Linguagem de fórmulas do sistema de jogo (0.10.0): uma só para máximo de recurso, dano, defesa,
// custo, peso máximo, condições e testes. Parser próprio (sem eval), puro e com limites.
//
//   números 10 2.5 · texto "chave" · nomes forca hp.max alvo.defesa
//   + - * / % ^ · == != < <= > >= · e ou não (também && || !) · ( )
//   funções: min max arred piso teto abs limitar(x,a,b) se(cond,a,b) e as do contexto
//   (tem("item"), equipado("item"), cabe("item"), perfil("campo"), missao("chave"))
//   dados: 1d20 2d6 d8 — com vantagem: 2d20k1 (fica com o maior) / 2d20kl1 (o menor)

export const FORMULA_LIMITS = { length: 500, depth: 32, diceCount: 100, diceSides: 1000 };

export type FormulaValue = number | boolean | string;

export type FormulaNode =
  | { type: "number"; value: number }
  | { type: "string"; value: string }
  | { type: "name"; name: string }
  | { type: "dice"; count: number; sides: number; keep: number | null; keepLowest: boolean }
  | { type: "unary"; op: "-" | "!"; arg: FormulaNode }
  | { type: "binary"; op: string; left: FormulaNode; right: FormulaNode }
  | { type: "call"; name: string; args: FormulaNode[] };

export class FormulaError extends Error {}

type Token =
  | { kind: "number"; value: number }
  | { kind: "string"; value: string }
  | { kind: "name"; value: string }
  | { kind: "dice"; count: number; sides: number; keep: number | null; keepLowest: boolean }
  | { kind: "op"; value: string }
  | { kind: "paren"; value: "(" | ")" }
  | { kind: "comma" };

const WORD_OPS: Record<string, string> = { e: "&&", ou: "||", não: "!", nao: "!", and: "&&", or: "||", not: "!" };
const NAME_START = /[\p{L}_]/u;
const NAME_PART = /[\p{L}\p{N}_.]/u;

function tokenize(source: string): Token[] {
  if (source.length > FORMULA_LIMITS.length) throw new FormulaError(`Fórmula longa demais (máximo ${FORMULA_LIMITS.length} caracteres).`);
  const tokens: Token[] = [];
  let index = 0;
  while (index < source.length) {
    const char = source[index];
    if (/\s/.test(char)) {
      index += 1;
      continue;
    }
    // Dados: [N]d<M>[k[l]<K>] — antes de número, porque "2d6" começa com dígito.
    const dice = /^(\d{0,3})d(\d{1,4})(?:k(l?)(\d{1,3}))?(?![\p{L}\p{N}_])/u.exec(source.slice(index));
    if (dice && (dice[1] !== "" || !NAME_PART.test(source[index - 1] ?? " "))) {
      const count = dice[1] === "" ? 1 : Number(dice[1]);
      const sides = Number(dice[2]);
      if (count < 1 || count > FORMULA_LIMITS.diceCount) throw new FormulaError(`Quantidade de dados entre 1 e ${FORMULA_LIMITS.diceCount}.`);
      if (sides < 2 || sides > FORMULA_LIMITS.diceSides) throw new FormulaError(`Dado precisa ter de 2 a ${FORMULA_LIMITS.diceSides} lados.`);
      const keep = dice[4] ? Number(dice[4]) : null;
      if (keep !== null && (keep < 1 || keep > count)) throw new FormulaError("Quantidade de dados mantidos inválida.");
      tokens.push({ kind: "dice", count, sides, keep, keepLowest: dice[3] === "l" });
      index += dice[0].length;
      continue;
    }
    // Decimal com ponto (2.5): a vírgula separa os valores de uma função, max(1, 2).
    const number = /^\d+(?:\.\d+)?/.exec(source.slice(index));
    if (number) {
      tokens.push({ kind: "number", value: Number(number[0]) });
      index += number[0].length;
      continue;
    }
    if (char === '"') {
      const end = source.indexOf('"', index + 1);
      if (end < 0) throw new FormulaError("Texto entre aspas sem fechar.");
      tokens.push({ kind: "string", value: source.slice(index + 1, end) });
      index = end + 1;
      continue;
    }
    if (NAME_START.test(char)) {
      let end = index + 1;
      while (end < source.length && NAME_PART.test(source[end])) end += 1;
      const word = source.slice(index, end);
      const op = WORD_OPS[word.toLowerCase()];
      if (op) tokens.push({ kind: "op", value: op });
      else tokens.push({ kind: "name", value: word });
      index = end;
      continue;
    }
    const two = source.slice(index, index + 2);
    if (["==", "!=", "<=", ">=", "&&", "||"].includes(two)) {
      tokens.push({ kind: "op", value: two });
      index += 2;
      continue;
    }
    if ("+-*/%^<>!".includes(char)) {
      tokens.push({ kind: "op", value: char });
      index += 1;
      continue;
    }
    if (char === "=") {
      tokens.push({ kind: "op", value: "==" });
      index += 1;
      continue;
    }
    if (char === "(" || char === ")") {
      tokens.push({ kind: "paren", value: char });
      index += 1;
      continue;
    }
    if (char === "," || char === ";") {
      tokens.push({ kind: "comma" });
      index += 1;
      continue;
    }
    throw new FormulaError(`Símbolo inesperado "${char}".`);
  }
  return tokens;
}

const BINARY_PRECEDENCE: Record<string, number> = {
  "||": 1,
  "&&": 2,
  "==": 3,
  "!=": 3,
  "<": 4,
  "<=": 4,
  ">": 4,
  ">=": 4,
  "+": 5,
  "-": 5,
  "*": 6,
  "/": 6,
  "%": 6,
  "^": 8,
};

class Parser {
  private position = 0;
  constructor(private readonly tokens: Token[]) {}

  parse(): FormulaNode {
    if (this.tokens.length === 0) throw new FormulaError("Fórmula vazia.");
    const node = this.expression(0, 0);
    if (this.position < this.tokens.length) throw new FormulaError("Sobrou algo no fim da fórmula.");
    return node;
  }

  private peek() {
    return this.tokens[this.position];
  }

  private expression(minPrecedence: number, depth: number): FormulaNode {
    if (depth > FORMULA_LIMITS.depth) throw new FormulaError("Fórmula aninhada demais.");
    let left = this.unary(depth + 1);
    for (;;) {
      const token = this.peek();
      if (!token || token.kind !== "op" || !(token.value in BINARY_PRECEDENCE)) break;
      const precedence = BINARY_PRECEDENCE[token.value];
      if (precedence < minPrecedence) break;
      this.position += 1;
      // ^ associa à direita; o resto, à esquerda.
      const right = this.expression(token.value === "^" ? precedence : precedence + 1, depth + 1);
      left = { type: "binary", op: token.value, left, right };
    }
    return left;
  }

  private unary(depth: number): FormulaNode {
    const token = this.peek();
    if (token?.kind === "op" && (token.value === "-" || token.value === "!" || token.value === "+")) {
      this.position += 1;
      const arg = this.expression(7, depth + 1);
      return token.value === "+" ? arg : { type: "unary", op: token.value as "-" | "!", arg };
    }
    return this.primary(depth);
  }

  private primary(depth: number): FormulaNode {
    const token = this.peek();
    if (!token) throw new FormulaError("A fórmula terminou antes da hora.");
    this.position += 1;
    switch (token.kind) {
      case "number":
        return { type: "number", value: token.value };
      case "string":
        return { type: "string", value: token.value };
      case "dice":
        return { type: "dice", count: token.count, sides: token.sides, keep: token.keep, keepLowest: token.keepLowest };
      case "paren": {
        if (token.value !== "(") throw new FormulaError('")" sem "(" correspondente.');
        const inner = this.expression(0, depth + 1);
        const close = this.peek();
        if (close?.kind !== "paren" || close.value !== ")") throw new FormulaError('Falta fechar ")".');
        this.position += 1;
        return inner;
      }
      case "name": {
        const next = this.peek();
        if (next?.kind === "paren" && next.value === "(") {
          this.position += 1;
          const args: FormulaNode[] = [];
          if (!(this.peek()?.kind === "paren" && (this.peek() as { value: string }).value === ")")) {
            for (;;) {
              args.push(this.expression(0, depth + 1));
              if (this.peek()?.kind === "comma") {
                this.position += 1;
                continue;
              }
              break;
            }
          }
          const close = this.peek();
          if (close?.kind !== "paren" || close.value !== ")") throw new FormulaError(`Falta fechar ")" em ${token.value}(…).`);
          this.position += 1;
          return { type: "call", name: token.value.toLowerCase(), args };
        }
        return { type: "name", name: token.value };
      }
      default:
        throw new FormulaError("Fórmula incompleta.");
    }
  }
}

const cache = new Map<string, FormulaNode>();

export function parseFormula(source: string): FormulaNode {
  const key = source.trim();
  const cached = cache.get(key);
  if (cached) return cached;
  const node = new Parser(tokenize(key)).parse();
  if (cache.size > 2000) cache.clear();
  cache.set(key, node);
  return node;
}

export type FormulaCheck = { ok: true; node: FormulaNode } | { ok: false; message: string };

export function checkFormula(source: string): FormulaCheck {
  try {
    return { ok: true, node: parseFormula(source) };
  } catch (error) {
    return { ok: false, message: error instanceof FormulaError ? error.message : "Fórmula inválida." };
  }
}

// ------------------------------------------------------------------ avaliação

export type DiceRoll = { notation: string; rolls: number[]; kept: number[]; total: number };

export type FormulaScope = {
  // Valor de um nome (variável, recurso, atributo, "hp.max", "alvo.defesa"...). undefined = não existe.
  get(name: string): FormulaValue | undefined;
  // Funções do contexto (tem, equipado, cabe, perfil, missao...). undefined = função desconhecida.
  call?(name: string, args: FormulaValue[]): FormulaValue | undefined;
  // Rolagem de um dado (1..sides). Sem isto, dado vale a média (validação, simulação de pior caso).
  roll?(sides: number): number;
  // Cada rolagem feita (para o detalhamento "14 (dado) + 3").
  onRoll?(roll: DiceRoll): void;
};

const BUILTINS: Record<string, (args: FormulaValue[]) => FormulaValue> = {
  min: (args) => Math.min(...args.map(num)),
  max: (args) => Math.max(...args.map(num)),
  arred: (args) => round(num(args[0]), num(args[1] ?? 0)),
  round: (args) => round(num(args[0]), num(args[1] ?? 0)),
  piso: (args) => Math.floor(num(args[0])),
  floor: (args) => Math.floor(num(args[0])),
  teto: (args) => Math.ceil(num(args[0])),
  ceil: (args) => Math.ceil(num(args[0])),
  abs: (args) => Math.abs(num(args[0])),
  limitar: (args) => Math.min(Math.max(num(args[0]), num(args[1])), num(args[2])),
  clamp: (args) => Math.min(Math.max(num(args[0]), num(args[1])), num(args[2])),
};
export const BUILTIN_FUNCTIONS = [...Object.keys(BUILTINS), "se", "if"];

function round(value: number, digits: number) {
  const factor = 10 ** Math.max(0, Math.min(6, Math.trunc(digits)));
  return Math.round(value * factor) / factor;
}

export function num(value: FormulaValue | undefined): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "string") return Number(value) || 0;
  return 0;
}

export function truthy(value: FormulaValue | undefined): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0 && Number.isFinite(value);
  return typeof value === "string" && value.length > 0;
}

function equals(a: FormulaValue, b: FormulaValue): boolean {
  if (typeof a === "string" || typeof b === "string") return String(a) === String(b);
  return num(a) === num(b);
}

function rollDice(node: Extract<FormulaNode, { type: "dice" }>, scope: FormulaScope): number {
  if (!scope.roll) {
    const mean = ((node.sides + 1) / 2) * (node.keep ?? node.count);
    return mean;
  }
  const rolls = Array.from({ length: node.count }, () => scope.roll!(node.sides));
  const sorted = [...rolls].sort((a, b) => (node.keepLowest ? a - b : b - a));
  const kept = node.keep === null ? rolls : sorted.slice(0, node.keep);
  const total = kept.reduce((sum, value) => sum + value, 0);
  const notation = `${node.count}d${node.sides}${node.keep === null ? "" : `k${node.keepLowest ? "l" : ""}${node.keep}`}`;
  scope.onRoll?.({ notation, rolls, kept, total });
  return total;
}

export function evaluateNode(node: FormulaNode, scope: FormulaScope): FormulaValue {
  switch (node.type) {
    case "number":
      return node.value;
    case "string":
      return node.value;
    case "dice":
      return rollDice(node, scope);
    case "name": {
      const value = scope.get(node.name);
      if (value === undefined) throw new FormulaError(`"${node.name}" não existe.`);
      return value;
    }
    case "unary": {
      const value = evaluateNode(node.arg, scope);
      return node.op === "-" ? -num(value) : !truthy(value);
    }
    case "binary": {
      if (node.op === "&&") return truthy(evaluateNode(node.left, scope)) && truthy(evaluateNode(node.right, scope));
      if (node.op === "||") return truthy(evaluateNode(node.left, scope)) || truthy(evaluateNode(node.right, scope));
      const left = evaluateNode(node.left, scope);
      const right = evaluateNode(node.right, scope);
      switch (node.op) {
        case "==":
          return equals(left, right);
        case "!=":
          return !equals(left, right);
        case "<":
          return num(left) < num(right);
        case "<=":
          return num(left) <= num(right);
        case ">":
          return num(left) > num(right);
        case ">=":
          return num(left) >= num(right);
        case "+":
          return num(left) + num(right);
        case "-":
          return num(left) - num(right);
        case "*":
          return num(left) * num(right);
        case "/":
          return num(right) === 0 ? 0 : num(left) / num(right);
        case "%":
          return num(right) === 0 ? 0 : num(left) % num(right);
        case "^":
          return num(left) ** num(right);
      }
      throw new FormulaError(`Operador desconhecido "${node.op}".`);
    }
    case "call": {
      if (node.name === "se" || node.name === "if") {
        if (node.args.length !== 3) throw new FormulaError("se(condição, se_sim, se_não) precisa de 3 partes.");
        return truthy(evaluateNode(node.args[0], scope)) ? evaluateNode(node.args[1], scope) : evaluateNode(node.args[2], scope);
      }
      const args = node.args.map((arg) => evaluateNode(arg, scope));
      const builtin = BUILTINS[node.name];
      if (builtin) {
        if (args.length === 0) throw new FormulaError(`${node.name}() precisa de pelo menos um valor.`);
        return builtin(args);
      }
      const custom = scope.call?.(node.name, args);
      if (custom === undefined) throw new FormulaError(`Função "${node.name}" não existe.`);
      return custom;
    }
  }
}

export function evaluateFormula(source: string, scope: FormulaScope): FormulaValue {
  return evaluateNode(parseFormula(source), scope);
}

// Avaliação que nunca lança: fórmula quebrada vale `fallback` (o validador de publicação já barra
// fórmula inválida; isto protege a leitura de obra antiga ou rascunho).
export function evaluateNumber(source: string | number | null | undefined, scope: FormulaScope, fallback = 0): number {
  if (typeof source === "number") return source;
  if (source === null || source === undefined || String(source).trim() === "") return fallback;
  try {
    return num(evaluateFormula(String(source), scope));
  } catch {
    return fallback;
  }
}

export function evaluateBoolean(source: string, scope: FormulaScope, fallback = false): boolean {
  try {
    return truthy(evaluateFormula(source, scope));
  } catch {
    return fallback;
  }
}

// Nomes e funções que a fórmula usa (validador e autocompletar).
export function formulaReferences(node: FormulaNode): { names: Set<string>; functions: Set<string>; hasDice: boolean } {
  const names = new Set<string>();
  const functions = new Set<string>();
  let hasDice = false;
  const walk = (current: FormulaNode) => {
    switch (current.type) {
      case "name":
        names.add(current.name);
        break;
      case "dice":
        hasDice = true;
        break;
      case "unary":
        walk(current.arg);
        break;
      case "binary":
        walk(current.left);
        walk(current.right);
        break;
      case "call":
        functions.add(current.name);
        current.args.forEach(walk);
        break;
    }
  };
  walk(node);
  return { names, functions, hasDice };
}

// Confere a fórmula contra os nomes e funções que existem na obra.
export function validateFormula(
  source: string,
  known: { names: Set<string>; functions: Set<string>; allowDice?: boolean },
): string | null {
  const parsed = checkFormula(source);
  if (!parsed.ok) return parsed.message;
  const refs = formulaReferences(parsed.node);
  for (const name of refs.names) if (!known.names.has(name)) return `"${name}" não existe.`;
  for (const fn of refs.functions) {
    if (!BUILTIN_FUNCTIONS.includes(fn) && !known.functions.has(fn)) return `Função "${fn}" não existe.`;
  }
  if (refs.hasDice && known.allowDice === false) return "Dados não são permitidos aqui.";
  return null;
}
