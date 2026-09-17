/** One currency's price on a single market. */
export interface CurrencyPrice {
  id: string;
  price: number;
}

/** Every requested currency's price on one market. */
export interface MarketPrice {
  marketId: string;
  currencyPrices: CurrencyPrice[];
}
