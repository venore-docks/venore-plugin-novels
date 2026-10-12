// Gerador determinístico das rolagens: semente da partida + contador de rolagens. A mesma escolha
// no mesmo ponto da partida rola o mesmo número (voltar e tentar de novo não muda o dado), e o
// replay do registro de ações reproduz a partida inteira.

function hashString(value: string): number {
  // FNV-1a de 32 bits.
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function mulberry32(seed: number): number {
  let value = (seed + 0x6d2b79f5) >>> 0;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
}

// Número em [0, 1) para a rolagem número `counter` da partida com essa semente.
export function randomAt(seed: string, counter: number): number {
  return mulberry32(hashString(seed) ^ Math.imul(counter + 1, 0x9e3779b9));
}

export function dieAt(seed: string, counter: number, sides: number): number {
  return 1 + Math.floor(randomAt(seed, counter) * sides);
}

export function newSeed(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  return Math.random().toString(36).slice(2, 18);
}
