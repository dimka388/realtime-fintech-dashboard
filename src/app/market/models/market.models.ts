/**
 * One generated market update.
 *
 * Each update contains one completed trade and the latest bid/ask snapshot.
 */
export interface MarketUpdate {
  readonly instrument: string;

  /**
   * Trade price in cents.
   *
   * For example, 10_200 means $102.00.
   */
  readonly priceCents: number;

  /**
   * Number of units in the completed trade.
   */
  readonly tradeQuantity: number;

  /**
   * Current bid price in cents.
   */
  readonly bidCents: number;

  /**
   * Current ask price in cents.
   */
  readonly askCents: number;

  /**
   * Available quantity at the bid price.
   */
  readonly bidQuantity: number;

  /**
   * Available quantity at the ask price.
   */
  readonly askQuantity: number;
}

/**
 * Calculated metrics for one instrument.
 *
 * null means that a metric cannot be calculated yet.
 */
export interface InstrumentMetrics {
  readonly instrument: string;
  readonly lastPriceCents: number | null;
  readonly spreadCents: number | null;
  readonly volume: number;
  readonly vwapCents: number | null;
  readonly imbalance: number | null;
}
