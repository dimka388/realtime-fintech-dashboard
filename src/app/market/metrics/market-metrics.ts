import {
  InstrumentMetrics,
  MarketUpdate,
} from '../models/market.models';

interface InstrumentAccumulator {
  readonly instrument: string;

  lastPriceCents: number | null;
  latestBidCents: number | null;
  latestAskCents: number | null;
  latestBidQuantity: number | null;
  latestAskQuantity: number | null;

  cumulativeVolume: number;
  cumulativePriceQuantity: number;
}

function createAccumulator(instrument: string): InstrumentAccumulator {
  return {
    instrument,

    lastPriceCents: null,
    latestBidCents: null,
    latestAskCents: null,
    latestBidQuantity: null,
    latestAskQuantity: null,

    cumulativeVolume: 0,
    cumulativePriceQuantity: 0,
  };
}

function calculateMetrics(
  accumulator: InstrumentAccumulator,
): InstrumentMetrics {
  const {
    instrument,
    lastPriceCents,
    latestBidCents,
    latestAskCents,
    latestBidQuantity,
    latestAskQuantity,
    cumulativeVolume,
    cumulativePriceQuantity,
  } = accumulator;

  const spreadCents =
    latestBidCents === null || latestAskCents === null
      ? null
      : latestAskCents - latestBidCents;

  const vwapCents =
    cumulativeVolume === 0
      ? null
      : cumulativePriceQuantity / cumulativeVolume;

  const bookQuantity =
    latestBidQuantity === null || latestAskQuantity === null
      ? null
      : latestBidQuantity + latestAskQuantity;

  const imbalance =
    bookQuantity === null || bookQuantity === 0
      ? null
      : (latestBidQuantity! - latestAskQuantity!) / bookQuantity;

  return {
    instrument,
    lastPriceCents,
    spreadCents,
    volume: cumulativeVolume,
    vwapCents,
    imbalance,
  };
}

/**
 * Хранит только накопленные значения.
 *
 * Полная история MarketUpdate не сохраняется.
 */
export class MarketMetricsAggregator {
  private readonly accumulators =
    new Map<string, InstrumentAccumulator>();

  constructor(instruments: readonly string[]) {
    this.reset(instruments);
  }

  /**
   * Учитывает одно рыночное событие.
   */
  process(update: MarketUpdate): void {
    const accumulator = this.accumulators.get(update.instrument);

    if (!accumulator) {
      throw new Error(
        `Received update for unknown instrument: ${update.instrument}`,
      );
    }

    accumulator.lastPriceCents = update.priceCents;
    accumulator.latestBidCents = update.bidCents;
    accumulator.latestAskCents = update.askCents;
    accumulator.latestBidQuantity = update.bidQuantity;
    accumulator.latestAskQuantity = update.askQuantity;

    accumulator.cumulativeVolume += update.tradeQuantity;
    accumulator.cumulativePriceQuantity +=
      update.priceCents * update.tradeQuantity;
  }

  /**
   * Учитывает пакет событий.
   */
  processBatch(updates: readonly MarketUpdate[]): void {
    for (const update of updates) {
      this.process(update);
    }
  }

  /**
   * Возвращает текущее состояние всех инструментов.
   */
  getSnapshot(): InstrumentMetrics[] {
    return Array.from(
      this.accumulators.values(),
      calculateMetrics,
    );
  }

  /**
   * Полностью очищает предыдущий run.
   */
  reset(instruments: readonly string[]): void {
    this.accumulators.clear();

    for (const instrument of instruments) {
      if (this.accumulators.has(instrument)) {
        throw new Error(`Duplicate instrument: ${instrument}`);
      }

      this.accumulators.set(
        instrument,
        createAccumulator(instrument),
      );
    }
  }
}
