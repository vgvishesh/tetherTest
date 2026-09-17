/** A single coin from the market-cap ranking, as the application consumes it. */
export interface MarketCoin {
  id: string;
  symbol: string;
  name: string;
  currentPrice: number;
  marketCap: number;
  marketCapRank: number;
  totalVolume: number;
}
