import { MarketUpdate } from '../models/market.models';
import { MarketMetricsAggregator } from './market-metrics';

function createUpdate(
  overrides: Partial<MarketUpdate> = {},
): MarketUpdate {
  return {
    instrument: 'ALFA',
    priceCents: 10_000,
    tradeQuantity: 10,
    bidCents: 9_999,
    askCents: 10_000,
    bidQuantity: 100,
    askQuantity: 100,
    ...overrides,
  };
}

describe('MarketMetricsAggregator', () => {
  it('returns unavailable values and zero volume before data arrives', () => {
    const aggregator = new MarketMetricsAggregator(['ALFA']);

    expect(aggregator.getSnapshot()).toEqual([
      {
        instrument: 'ALFA',
        lastPriceCents: null,
        spreadCents: null,
        volume: 0,
        vwapCents: null,
        imbalance: null,
      },
    ]);
  });

  it('calculates the worked example from the task description', () => {
    const aggregator = new MarketMetricsAggregator(['ALFA']);

    aggregator.process(
      createUpdate({
        priceCents: 10_000,
        tradeQuantity: 10,
        bidCents: 9_996,
        askCents: 10_000,
        bidQuantity: 500,
        askQuantity: 500,
      }),
    );

    aggregator.process(
      createUpdate({
        priceCents: 10_200,
        tradeQuantity: 30,
        bidCents: 10_196,
        askCents: 10_200,
        bidQuantity: 600,
        askQuantity: 400,
      }),
    );

    expect(aggregator.getSnapshot()).toEqual([
      {
        instrument: 'ALFA',
        lastPriceCents: 10_200,
        spreadCents: 4,
        volume: 40,
        vwapCents: 10_150,
        imbalance: 0.2,
      },
    ]);
  });

  it('returns unavailable imbalance when its denominator is zero', () => {
    const aggregator = new MarketMetricsAggregator(['ALFA']);

    aggregator.process(
      createUpdate({
        bidQuantity: 0,
        askQuantity: 0,
      }),
    );

    expect(aggregator.getSnapshot()[0].imbalance).toBeNull();
  });

  it('keeps instruments isolated from each other', () => {
    const aggregator = new MarketMetricsAggregator([
      'ALFA',
      'BETA',
    ]);

    aggregator.process(
      createUpdate({
        instrument: 'ALFA',
        priceCents: 10_000,
        tradeQuantity: 10,
      }),
    );

    aggregator.process(
      createUpdate({
        instrument: 'BETA',
        priceCents: 20_000,
        tradeQuantity: 30,
        bidCents: 19_998,
        askCents: 20_000,
      }),
    );

    const [alfa, beta] = aggregator.getSnapshot();

    expect(alfa.instrument).toBe('ALFA');
    expect(alfa.volume).toBe(10);
    expect(alfa.lastPriceCents).toBe(10_000);

    expect(beta.instrument).toBe('BETA');
    expect(beta.volume).toBe(30);
    expect(beta.lastPriceCents).toBe(20_000);
  });

  it('processes every update in a batch', () => {
    const aggregator = new MarketMetricsAggregator(['ALFA']);

    aggregator.processBatch([
      createUpdate({
        tradeQuantity: 10,
      }),
      createUpdate({
        tradeQuantity: 20,
      }),
      createUpdate({
        tradeQuantity: 30,
      }),
    ]);

    expect(aggregator.getSnapshot()[0].volume).toBe(60);
  });

  it('rejects updates for an unknown instrument', () => {
    const aggregator = new MarketMetricsAggregator(['ALFA']);

    expect(() => {
      aggregator.process(
        createUpdate({
          instrument: 'UNKNOWN',
        }),
      );
    }).toThrowError(
      'Received update for unknown instrument: UNKNOWN',
    );
  });

  it('clears previous values when reset is called', () => {
    const aggregator = new MarketMetricsAggregator(['ALFA']);

    aggregator.process(
      createUpdate({
        tradeQuantity: 25,
      }),
    );

    aggregator.reset(['BETA']);

    expect(aggregator.getSnapshot()).toEqual([
      {
        instrument: 'BETA',
        lastPriceCents: null,
        spreadCents: null,
        volume: 0,
        vwapCents: null,
        imbalance: null,
      },
    ]);
  });

  it('rejects duplicate instrument names', () => {
    expect(() => {
      new MarketMetricsAggregator(['ALFA', 'ALFA']);
    }).toThrowError('Duplicate instrument: ALFA');
  });
});
