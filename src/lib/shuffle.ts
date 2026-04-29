import { yieldToMainThread } from "./async";

const SHUFFLE_CHUNK_SIZE = 50_000;

function mix(value: number): number {
  let state = value | 0;
  state = Math.imul(state ^ 0x45d9f3b, 0x45d9f3b);
  state ^= state >>> 16;
  state = Math.imul(state, 0x45d9f3b);
  state ^= state >>> 16;
  return state >>> 0;
}

function createSeededRandom(seed: number): () => number {
  let state = mix(seed || 1);

  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

export function buildShuffleSeed(
  totalRows: number,
  shuffleCount: number,
  userSeed: number
): number {
  return (
    (Math.imul((userSeed >>> 0) + 1, 0xc2b2ae35) ^
      Math.imul(totalRows + 1, 0x9e3779b1) ^
      Math.imul(shuffleCount + 1, 0x85ebca6b)) >>>
    0
  );
}

export async function createShuffledIndexOrder(
  totalRows: number,
  seed: number,
  signal?: AbortSignal
): Promise<Uint32Array> {
  const order = new Uint32Array(totalRows);

  for (let index = 0; index < totalRows; index += 1) {
    order[index] = index;

    if (index > 0 && index % SHUFFLE_CHUNK_SIZE === 0) {
      await yieldToMainThread(signal);
    }
  }

  const random = createSeededRandom(seed);

  for (let index = totalRows - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    const current = order[index]!;
    order[index] = order[swapIndex]!;
    order[swapIndex] = current;

    if (index % SHUFFLE_CHUNK_SIZE === 0) {
      await yieldToMainThread(signal);
    }
  }

  return order;
}
