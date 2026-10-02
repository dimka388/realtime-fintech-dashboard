/**
 * Одно сгенерированное рыночное событие.
 *
 * Каждое событие содержит одну совершённую сделку
 * и актуальный снимок bid/ask.
 */
export interface MarketUpdate {
  readonly instrument: string;

  /**
   * Цена сделки в центах.
   *
   * Например, 10_200 означает $102.00.
   */
  readonly priceCents: number;

  /**
   * Количество единиц в совершённой сделке.
   */
  readonly tradeQuantity: number;

  /**
   * Текущая доступная цена покупки в центах.
   */
  readonly bidCents: number;

  /**
   * Текущая доступная цена продажи в центах.
   */
  readonly askCents: number;

  /**
   * Доступное количество по цене bid.
   */
  readonly bidQuantity: number;

  /**
   * Доступное количество по цене ask.
   */
  readonly askQuantity: number;
}

/**
 * Рассчитанные показатели одного инструмента.
 *
 * null означает, что показатель пока невозможно рассчитать.
 */
export interface InstrumentMetrics {
  readonly instrument: string;
  readonly lastPriceCents: number | null;
  readonly spreadCents: number | null;
  readonly volume: number;
  readonly vwapCents: number | null;
  readonly imbalance: number | null;
}
