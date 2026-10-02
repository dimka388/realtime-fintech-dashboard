import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  generateBatch,
  initialize,
  updateFieldCount,
} from '../public/wasm/producer.js';

const INSTRUMENT_INDEX = 0;
const PRICE_CENTS = 1;
const TRADE_QUANTITY = 2;
const BID_CENTS = 3;
const ASK_CENTS = 4;
const BID_QUANTITY = 5;
const ASK_QUANTITY = 6;

describe('AssemblyScript market producer', () => {
  it('returns the requested batch size', () => {
    initialize(5, 123);

    for (const batchSize of [1, 100, 1_000]) {
      const batch = generateBatch(batchSize);

      assert.equal(
        batch.length,
        batchSize * updateFieldCount(),
      );
    }
  });

  it('generates valid market updates', () => {
    const numberOfInstruments = 5;

    initialize(numberOfInstruments, 456);

    const batch = generateBatch(1_000);
    const fieldCount = updateFieldCount();

    for (
      let offset = 0;
      offset < batch.length;
      offset += fieldCount
    ) {
      const instrumentIndex =
        batch[offset + INSTRUMENT_INDEX];

      const priceCents =
        batch[offset + PRICE_CENTS];

      const tradeQuantity =
        batch[offset + TRADE_QUANTITY];

      const bidCents =
        batch[offset + BID_CENTS];

      const askCents =
        batch[offset + ASK_CENTS];

      const bidQuantity =
        batch[offset + BID_QUANTITY];

      const askQuantity =
        batch[offset + ASK_QUANTITY];

      assert.ok(instrumentIndex >= 0);
      assert.ok(instrumentIndex < numberOfInstruments);

      assert.ok(priceCents > 0);
      assert.ok(tradeQuantity > 0);

      assert.ok(bidCents > 0);
      assert.ok(bidCents < askCents);

      assert.ok(
        priceCents === bidCents ||
          priceCents === askCents,
      );

      assert.ok(bidQuantity >= 0);
      assert.ok(askQuantity >= 0);
    }
  });

  it('produces repeatable results with a fixed seed', () => {
    initialize(3, 789);
    const first = Array.from(generateBatch(25));

    initialize(3, 789);
    const second = Array.from(generateBatch(25));

    assert.deepEqual(second, first);
  });

  it('retains generator state between calls', () => {
    initialize(3, 987);

    const firstBatch = Array.from(generateBatch(10));
    const secondBatch = Array.from(generateBatch(15));

    initialize(3, 987);

    const combinedBatch = Array.from(generateBatch(25));

    assert.deepEqual(
      [...firstBatch, ...secondBatch],
      combinedBatch,
    );
  });

  it('evolves prices from their previous values', () => {
    initialize(1, 654);

    const batch = generateBatch(100);
    const fieldCount = updateFieldCount();

    let previousPrice = 10_000;

    for (
      let offset = 0;
      offset < batch.length;
      offset += fieldCount
    ) {
      const currentPrice =
        batch[offset + PRICE_CENTS];

      /*
       * The reference price moves by at most 5 cents, the bid offset
       * is at most 4 cents, and the spread is at most 10 cents.
       */
      assert.ok(
        Math.abs(currentPrice - previousPrice) <= 15,
      );

      previousPrice = currentPrice;
    }
  });

  it('resets state when initialized again', () => {
    initialize(2, 321);
    const original = Array.from(generateBatch(20));

    generateBatch(50);

    initialize(2, 321);
    const afterReset = Array.from(generateBatch(20));

    assert.deepEqual(afterReset, original);
  });
});
