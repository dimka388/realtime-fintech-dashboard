const UPDATE_FIELD_COUNT: i32 = 7;

const MIN_INSTRUMENT_COUNT: i32 = 1;
const MAX_INSTRUMENT_COUNT: i32 = 50;

const MIN_BATCH_SIZE: i32 = 1;
const MAX_BATCH_SIZE: i32 = 1_000;

const MIN_PRICE_CENTS: i32 = 100;
const INITIAL_PRICE_CENTS: i32 = 10_000;
const INITIAL_PRICE_STEP_CENTS: i32 = 500;

let instrumentCount: i32 = 0;
let randomState: u32 = 1;
let prices = new Int32Array(0);

/**
 * Xorshift32 — небольшой детерминированный PRNG.
 *
 * Один и тот же seed создаёт одну и ту же последовательность.
 */
function nextRandom(): u32 {
  let value = randomState;

  value ^= value << 13;
  value ^= value >> 17;
  value ^= value << 5;

  randomState = value;

  return value;
}

function randomInteger(
  minimumInclusive: i32,
  maximumInclusive: i32,
): i32 {
  const range = <u32>(
    maximumInclusive - minimumInclusive + 1
  );

  return minimumInclusive + <i32>(nextRandom() % range);
}

/**
 * Создаёт новый run генератора.
 *
 * Повторный вызов очищает состояние предыдущего run.
 */
export function initialize(
  newInstrumentCount: i32,
  seed: u32,
): void {
  assert(
    newInstrumentCount >= MIN_INSTRUMENT_COUNT &&
      newInstrumentCount <= MAX_INSTRUMENT_COUNT,
    'Instrument count must be between 1 and 50',
  );

  instrumentCount = newInstrumentCount;

  // Xorshift не должен начинать с нулевого состояния.
  randomState = seed == 0 ? 0x6d2b79f5 : seed;

  prices = new Int32Array(instrumentCount);

  for (let index: i32 = 0; index < instrumentCount; index++) {
    prices[index] =
      INITIAL_PRICE_CENTS +
      index * INITIAL_PRICE_STEP_CENTS;
  }
}

/**
 * Количество числовых полей в одном событии.
 */
export function updateFieldCount(): i32 {
  return UPDATE_FIELD_COUNT;
}

/**
 * Генерирует заданное количество рыночных событий.
 */
export function generateBatch(
  updateCount: i32,
): Int32Array {
  assert(
    instrumentCount > 0,
    'Producer must be initialized before generating data',
  );

  assert(
    updateCount >= MIN_BATCH_SIZE &&
      updateCount <= MAX_BATCH_SIZE,
    'Batch size must be between 1 and 1000',
  );

  const result = new Int32Array(
    updateCount * UPDATE_FIELD_COUNT,
  );

  let outputIndex: i32 = 0;

  for (
    let updateIndex: i32 = 0;
    updateIndex < updateCount;
    updateIndex++
  ) {
    const instrumentIndex = randomInteger(
      0,
      instrumentCount - 1,
    );

    const previousPrice = prices[instrumentIndex];

    // Цена эволюционирует от предыдущего значения.
    const priceMovement = randomInteger(-5, 5);

    let referencePrice = previousPrice + priceMovement;

    if (referencePrice < MIN_PRICE_CENTS) {
      referencePrice = MIN_PRICE_CENTS;
    }

    const bidOffset = randomInteger(0, 4);
    const spread = randomInteger(1, 10);

    let bidCents = referencePrice - bidOffset;

    if (bidCents < 1) {
      bidCents = 1;
    }

    const askCents = bidCents + spread;

    // Цена сделки обязательно равна bid или ask.
    const priceCents =
      randomInteger(0, 1) == 0
        ? bidCents
        : askCents;

    const tradeQuantity = randomInteger(1, 100);
    const bidQuantity = randomInteger(0, 1_000);
    const askQuantity = randomInteger(0, 1_000);

    // Следующее событие этого инструмента продолжит эту цену.
    prices[instrumentIndex] = priceCents;

    result[outputIndex++] = instrumentIndex;
    result[outputIndex++] = priceCents;
    result[outputIndex++] = tradeQuantity;
    result[outputIndex++] = bidCents;
    result[outputIndex++] = askCents;
    result[outputIndex++] = bidQuantity;
    result[outputIndex++] = askQuantity;
  }

  return result;
}
