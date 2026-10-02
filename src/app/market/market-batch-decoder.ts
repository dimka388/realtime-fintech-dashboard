import { MarketUpdate } from './models/market.models';

export const MARKET_UPDATE_FIELD_COUNT = 7;

const INSTRUMENT_INDEX = 0;
const PRICE_CENTS = 1;
const TRADE_QUANTITY = 2;
const BID_CENTS = 3;
const ASK_CENTS = 4;
const BID_QUANTITY = 5;
const ASK_QUANTITY = 6;

export function decodeMarketBatch(
  batch: Int32Array,
  instruments: readonly string[],
): MarketUpdate[] {
  if (batch.length % MARKET_UPDATE_FIELD_COUNT !== 0) {
    throw new Error(
      `Invalid market batch length: ${batch.length}`,
    );
  }

  const updateCount =
    batch.length / MARKET_UPDATE_FIELD_COUNT;

  const updates = new Array<MarketUpdate>(updateCount);

  for (
    let offset = 0, updateIndex = 0;
    offset < batch.length;
    offset += MARKET_UPDATE_FIELD_COUNT, updateIndex++
  ) {
    const instrumentIndex =
      batch[offset + INSTRUMENT_INDEX];

    const instrument = instruments[instrumentIndex];

    if (instrument === undefined) {
      throw new Error(
        `Invalid instrument index: ${instrumentIndex}`,
      );
    }

    updates[updateIndex] = {
      instrument,
      priceCents: batch[offset + PRICE_CENTS],
      tradeQuantity: batch[offset + TRADE_QUANTITY],
      bidCents: batch[offset + BID_CENTS],
      askCents: batch[offset + ASK_CENTS],
      bidQuantity: batch[offset + BID_QUANTITY],
      askQuantity: batch[offset + ASK_QUANTITY],
    };
  }

  return updates;
}
