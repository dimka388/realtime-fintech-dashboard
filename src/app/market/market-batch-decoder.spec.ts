import {
  decodeMarketBatch,
  MARKET_UPDATE_FIELD_COUNT,
} from './market-batch-decoder';

describe('decodeMarketBatch', () => {
  it('decodes an encoded Wasm update', () => {
    const batch = new Int32Array([
      0,
      10_200,
      30,
      10_196,
      10_200,
      600,
      400,
    ]);

    expect(decodeMarketBatch(batch, ['ALFA'])).toEqual([
      {
        instrument: 'ALFA',
        priceCents: 10_200,
        tradeQuantity: 30,
        bidCents: 10_196,
        askCents: 10_200,
        bidQuantity: 600,
        askQuantity: 400,
      },
    ]);
  });

  it('decodes every update in a batch', () => {
    const batch = new Int32Array([
      0, 10_000, 10, 9_999, 10_000, 100, 200,
      1, 20_000, 20, 19_998, 20_000, 300, 400,
    ]);

    const updates = decodeMarketBatch(batch, [
      'ALFA',
      'BETA',
    ]);

    expect(updates).toHaveLength(2);
    expect(updates[0].instrument).toBe('ALFA');
    expect(updates[1].instrument).toBe('BETA');

    expect(batch.length).toBe(
      updates.length * MARKET_UPDATE_FIELD_COUNT,
    );
  });

  it('rejects incomplete batches', () => {
    const batch = new Int32Array([
      0,
      10_200,
      30,
    ]);

    expect(() => {
      decodeMarketBatch(batch, ['ALFA']);
    }).toThrowError('Invalid market batch length: 3');
  });

  it('rejects unknown instrument indexes', () => {
    const batch = new Int32Array([
      3,
      10_200,
      30,
      10_196,
      10_200,
      600,
      400,
    ]);

    expect(() => {
      decodeMarketBatch(batch, ['ALFA']);
    }).toThrowError('Invalid instrument index: 3');
  });
});
