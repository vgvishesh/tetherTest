import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';
import type { AppConfig } from '../config/configuration';
import type { Market, MarketCoin, MarketPrice, TetherPrice } from './models';
import type {
  CoinMarketsApiResponse,
  ExchangeApiResponse,
  ExchangeTickersApiResponse,
  SimplePriceApiResponse,
} from './types/coingecko-api.types';

const API_PREFIX = '/api/v3';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isRetryable = (status?: number) =>
  status === undefined || status === 429 || status >= 500;

const TETHER_ID = 'tether';
const TETHER_VS_CURRENCY = 'usd';

@Injectable()
export class CoingeckoService {
  private readonly logger = new Logger(CoingeckoService.name);

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  /**
   * Top `topK` coins by market cap, priced in `priceCurrency`.
   * GET /api/v3/coins/markets
   */
  async getCoinsFromMarket(
    topK: number,
    priceCurrency = 'usd',
  ): Promise<MarketCoin[]> {
    const data = await this.get<CoinMarketsApiResponse[]>('/coins/markets', {
      vs_currency: priceCurrency,
      order: 'market_cap_desc',
      per_page: topK,
      page: 1,
    });

    return (data ?? []).map((coin) => ({
      id: coin.id,
      symbol: coin.symbol,
      name: coin.name,
      currentPrice: coin.current_price ?? 0,
      marketCap: coin.market_cap ?? 0,
      marketCapRank: coin.market_cap_rank ?? 0,
      totalVolume: coin.total_volume ?? 0,
    }));
  }

  /**
   * Current USDT/USD rate. Never assume 1.0 — USDT drifts off peg.
   * GET /api/v3/simple/price
   */
  async getTetherPrice(): Promise<TetherPrice> {
    const data = await this.get<SimplePriceApiResponse>('/simple/price', {
      ids: TETHER_ID,
      vs_currencies: TETHER_VS_CURRENCY,
      precision: 'full',
    });

    return { price: data?.[TETHER_ID]?.[TETHER_VS_CURRENCY] ?? 0 };
  }

  /**
   * Top `n` exchanges, highest trust score first.
   * GET /api/v3/exchanges
   */
  async getTopNMarkets(n: number): Promise<Market[]> {
    const data = await this.get<ExchangeApiResponse[]>('/exchanges', {
      per_page: n,
      page: 1,
    });

    return (data ?? [])
      .map((exchange) => ({
        id: exchange.id,
        name: exchange.name,
        trustScore: exchange.trust_score ?? 0,
      }))
      .sort((a, b) => b.trustScore - a.trustScore)
      .slice(0, n);
  }

  /**
   * Prices for `currencies` on one market, quoted against `target`.
   * GET /api/v3/exchanges/{marketId}/tickers
   *
   * A market lists each coin against several targets (USD, EUR, USDT, ...),
   * so we keep only the `target` pair. Coins the market does not list against
   * `target` are omitted rather than reported as zero — callers need to know
   * how many venues actually contributed.
   */
  async getMarketPrices(
    currencies: string[],
    marketId: string,
    target: string,
  ): Promise<MarketPrice> {
    if (currencies.length === 0) {
      return { marketId, currencyPrices: [] };
    }

    const data = await this.get<ExchangeTickersApiResponse>(
      `/exchanges/${marketId}/tickers`,
      { coin_ids: currencies.join(',') },
    );

    const requested = new Set(currencies);
    const currencyPrices = (data?.tickers ?? [])
      .filter(
        (ticker) =>
          ticker.target?.toUpperCase() === target.toUpperCase() &&
          typeof ticker.last === 'number' &&
          !ticker.is_stale &&
          !ticker.is_anomaly &&
          !!ticker.coin_id &&
          requested.has(ticker.coin_id),
      )
      .map((ticker) => ({ id: ticker.coin_id!, price: ticker.last! }));

    return { marketId, currencyPrices };
  }

  /**
   * Retries transient failures with an exponential backoff and only returns
   * once a call succeeds or the retry budget is spent.
   */
  private async get<T>(
    path: string,
    params: Record<string, string | number>,
  ): Promise<T> {
    const { maxRetries, retryBaseDelayMs } = this.config.get('coingecko', {
      infer: true,
    });

    let status: number | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await firstValueFrom(
          this.http.get<T>(`${API_PREFIX}${path}`, { params }),
        );
        return response.data;
      } catch (error) {
        status = (error as AxiosError).response?.status;

        if (!isRetryable(status) || attempt === maxRetries) {
          break;
        }

        const delayMs = retryBaseDelayMs * 2 ** attempt;
        this.logger.warn(
          `GET ${path} failed (HTTP ${status ?? 'no response'}), retry ${attempt + 1}/${maxRetries} in ${delayMs}ms`,
        );
        await sleep(delayMs);
      }
    }

    this.logger.error(
      `GET ${path} failed after ${maxRetries + 1} attempts (HTTP ${status ?? 'no response'})`,
    );
    throw new ServiceUnavailableException(
      `CoinGecko request failed${status ? ` with status ${status}` : ''}`,
    );
  }
}
