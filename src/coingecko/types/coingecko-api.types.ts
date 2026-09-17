/**
 * Wire types: these mirror CoinGecko's snake_case responses exactly.
 * They never leave CoingeckoService — everything crossing the boundary is
 * mapped to the camelCase models in ../models.
 */

/** GET /api/v3/coins/markets */
export interface CoinMarketsApiResponse {
  id: string;
  symbol: string;
  name: string;
  current_price: number | null;
  market_cap: number | null;
  market_cap_rank: number | null;
  total_volume: number | null;
}

/** GET /api/v3/simple/price?ids=tether&vs_currencies=usd */
export type SimplePriceApiResponse = Record<
  string,
  Record<string, number> | undefined
>;

/** GET /api/v3/exchanges */
export interface ExchangeApiResponse {
  id: string;
  name: string;
  trust_score: number | null;
}

/** GET /api/v3/exchanges/{id}/tickers */
export interface ExchangeTickerApiResponse {
  base: string;
  target: string;
  last: number | null;
  coin_id?: string;
  is_stale?: boolean;
  is_anomaly?: boolean;
}

export interface ExchangeTickersApiResponse {
  name: string;
  tickers: ExchangeTickerApiResponse[];
}
