import { HttpService } from '@nestjs/axios';
import { Logger, ServiceUnavailableException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AxiosError, AxiosResponse } from 'axios';
import { of, throwError } from 'rxjs';
import { CoingeckoService } from './coingecko.service';

const okResponse = <T>(data: T): AxiosResponse<T> =>
  ({
    data,
    status: 200,
    statusText: 'OK',
    headers: {},
    config: {},
  }) as AxiosResponse<T>;

/** Trimmed to the fields the service reads, but shaped exactly like the live API. */
const COINS_MARKETS_FIXTURE = [
  {
    id: 'bitcoin',
    symbol: 'btc',
    name: 'Bitcoin',
    current_price: 76463,
    market_cap: 1535530515721,
    market_cap_rank: 1,
    total_volume: 41234567890,
  },
  {
    id: 'ethereum',
    symbol: 'eth',
    name: 'Ethereum',
    current_price: 2442.32,
    market_cap: 297987857727,
    market_cap_rank: 2,
    total_volume: 21234567890,
  },
];

const EXCHANGES_FIXTURE = [
  { id: 'binance', name: 'Binance', trust_score: 10 },
  { id: 'gdax', name: 'Coinbase Exchange', trust_score: 9 },
  { id: 'kraken', name: 'Kraken', trust_score: 8 },
];

const EXCHANGE_TICKERS_FIXTURE = {
  name: 'Coinbase Exchange',
  tickers: [
    // Same coin quoted against several targets — only the USDT pair must survive.
    { base: 'BTC', target: 'USD', last: 76670.66, coin_id: 'bitcoin' },
    { base: 'BTC', target: 'EUR', last: 66837.33, coin_id: 'bitcoin' },
    { base: 'BTC', target: 'USDT', last: 76673.35, coin_id: 'bitcoin' },
    { base: 'ETH', target: 'USDT', last: 2445.35, coin_id: 'ethereum' },
  ],
};

describe('CoingeckoService', () => {
  let service: CoingeckoService;
  let get: jest.Mock;

  /** Query params the service sent on a given call. */
  const paramsOf = (call = 0): Record<string, string | number> => {
    const calls = get.mock.calls as Array<
      [string, { params: Record<string, string | number> }]
    >;
    return calls[call][1].params;
  };

  beforeEach(async () => {
    get = jest.fn();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CoingeckoService,
        { provide: HttpService, useValue: { get } },
      ],
    }).compile();

    service = module.get(CoingeckoService);
  });

  describe('getCoinsFromMarket', () => {
    it('returns camelCase MarketCoin objects', async () => {
      get.mockReturnValue(of(okResponse(COINS_MARKETS_FIXTURE)));

      const result = await service.getCoinsFromMarket(2);

      expect(result).toEqual([
        {
          id: 'bitcoin',
          symbol: 'btc',
          name: 'Bitcoin',
          currentPrice: 76463,
          marketCap: 1535530515721,
          marketCapRank: 1,
          totalVolume: 41234567890,
        },
        {
          id: 'ethereum',
          symbol: 'eth',
          name: 'Ethereum',
          currentPrice: 2442.32,
          marketCap: 297987857727,
          marketCapRank: 2,
          totalVolume: 21234567890,
        },
      ]);
    });

    it('exposes no snake_case keys from the wire format', async () => {
      get.mockReturnValue(of(okResponse(COINS_MARKETS_FIXTURE)));

      const [coin] = await service.getCoinsFromMarket(1);

      expect(Object.keys(coin).some((key) => key.includes('_'))).toBe(false);
      expect(coin).not.toHaveProperty('current_price');
      expect(coin).not.toHaveProperty('market_cap');
      expect(coin).not.toHaveProperty('market_cap_rank');
      expect(coin).not.toHaveProperty('total_volume');
    });

    it('returns numbers for every numeric field', async () => {
      get.mockReturnValue(of(okResponse(COINS_MARKETS_FIXTURE)));

      const [coin] = await service.getCoinsFromMarket(1);

      expect(typeof coin.id).toBe('string');
      expect(typeof coin.symbol).toBe('string');
      expect(typeof coin.name).toBe('string');
      expect(typeof coin.currentPrice).toBe('number');
      expect(typeof coin.marketCap).toBe('number');
      expect(typeof coin.marketCapRank).toBe('number');
      expect(typeof coin.totalVolume).toBe('number');
    });

    it('coerces null numerics to 0 rather than leaking null', async () => {
      get.mockReturnValue(
        of(
          okResponse([
            {
              id: 'x',
              symbol: 'x',
              name: 'X',
              current_price: null,
              market_cap: null,
              market_cap_rank: null,
              total_volume: null,
            },
          ]),
        ),
      );

      const [coin] = await service.getCoinsFromMarket(1);

      expect(coin.currentPrice).toBe(0);
      expect(coin.marketCap).toBe(0);
      expect(coin.marketCapRank).toBe(0);
      expect(coin.totalVolume).toBe(0);
    });

    it('sends vs_currency, ordering and per_page to the API', async () => {
      get.mockReturnValue(of(okResponse(COINS_MARKETS_FIXTURE)));

      await service.getCoinsFromMarket(5, 'eur');

      expect(get).toHaveBeenCalledWith('/api/v3/coins/markets', {
        params: {
          vs_currency: 'eur',
          order: 'market_cap_desc',
          per_page: 5,
          page: 1,
        },
      });
    });

    it('defaults priceCurrency to usd', async () => {
      get.mockReturnValue(of(okResponse(COINS_MARKETS_FIXTURE)));

      await service.getCoinsFromMarket(5);

      expect(paramsOf().vs_currency).toBe('usd');
    });
  });

  describe('getTetherPrice', () => {
    it('returns a single numeric price field', async () => {
      get.mockReturnValue(
        of(okResponse({ tether: { usd: 0.9991172922710287 } })),
      );

      const result = await service.getTetherPrice();

      expect(result).toEqual({ price: 0.9991172922710287 });
      expect(typeof result.price).toBe('number');
      expect(Object.keys(result)).toEqual(['price']);
    });

    it('always sends vs_currencies, which the API requires (HTTP 422 without it)', async () => {
      get.mockReturnValue(of(okResponse({ tether: { usd: 1 } })));

      await service.getTetherPrice();

      expect(paramsOf()).toMatchObject({
        ids: 'tether',
        vs_currencies: 'usd',
      });
    });

    it('returns 0 when the payload is missing the tether entry', async () => {
      get.mockReturnValue(of(okResponse({})));

      await expect(service.getTetherPrice()).resolves.toEqual({ price: 0 });
    });
  });

  describe('getTopNMarkets', () => {
    it('returns camelCase Market objects', async () => {
      get.mockReturnValue(of(okResponse(EXCHANGES_FIXTURE)));

      const result = await service.getTopNMarkets(3);

      expect(result).toEqual([
        { id: 'binance', name: 'Binance', trustScore: 10 },
        { id: 'gdax', name: 'Coinbase Exchange', trustScore: 9 },
        { id: 'kraken', name: 'Kraken', trustScore: 8 },
      ]);
      result.forEach((market) => {
        expect(typeof market.id).toBe('string');
        expect(typeof market.name).toBe('string');
        expect(typeof market.trustScore).toBe('number');
        expect(market).not.toHaveProperty('trust_score');
      });
    });

    it('sorts by trustScore descending regardless of API order', async () => {
      get.mockReturnValue(
        of(
          okResponse([
            { id: 'low', name: 'Low', trust_score: 4 },
            { id: 'high', name: 'High', trust_score: 10 },
            { id: 'mid', name: 'Mid', trust_score: 7 },
          ]),
        ),
      );

      const result = await service.getTopNMarkets(3);

      expect(result.map((m) => m.id)).toEqual(['high', 'mid', 'low']);
    });

    it('never returns more than n markets', async () => {
      get.mockReturnValue(of(okResponse(EXCHANGES_FIXTURE)));

      await expect(service.getTopNMarkets(2)).resolves.toHaveLength(2);
    });
  });

  describe('getMarketPrices', () => {
    it('returns a MarketPrice keyed by marketId with USDT-only prices', async () => {
      get.mockReturnValue(of(okResponse(EXCHANGE_TICKERS_FIXTURE)));

      const result = await service.getMarketPrices(['bitcoin', 'ethereum']);

      expect(result).toEqual({
        marketId: 'gdax',
        currencyPrices: [
          { id: 'bitcoin', price: 76673.35 },
          { id: 'ethereum', price: 2445.35 },
        ],
      });
    });

    it('returns correct types throughout the nested shape', async () => {
      get.mockReturnValue(of(okResponse(EXCHANGE_TICKERS_FIXTURE)));

      const result = await service.getMarketPrices(['bitcoin', 'ethereum']);

      expect(typeof result.marketId).toBe('string');
      expect(Array.isArray(result.currencyPrices)).toBe(true);
      result.currencyPrices.forEach((entry) => {
        expect(typeof entry.id).toBe('string');
        expect(typeof entry.price).toBe('number');
        expect(Object.keys(entry).sort()).toEqual(['id', 'price']);
      });
    });

    it('drops non-USDT targets for the same coin', async () => {
      get.mockReturnValue(of(okResponse(EXCHANGE_TICKERS_FIXTURE)));

      const result = await service.getMarketPrices(['bitcoin']);

      expect(result.currencyPrices).toEqual([
        { id: 'bitcoin', price: 76673.35 },
      ]);
    });

    it('omits stale or anomalous tickers instead of averaging bad ticks', async () => {
      get.mockReturnValue(
        of(
          okResponse({
            name: 'Coinbase Exchange',
            tickers: [
              {
                base: 'BTC',
                target: 'USDT',
                last: 1,
                coin_id: 'bitcoin',
                is_stale: true,
              },
              {
                base: 'ETH',
                target: 'USDT',
                last: 2,
                coin_id: 'ethereum',
                is_anomaly: true,
              },
              { base: 'XRP', target: 'USDT', last: 1.3, coin_id: 'ripple' },
            ],
          }),
        ),
      );

      const result = await service.getMarketPrices([
        'bitcoin',
        'ethereum',
        'ripple',
      ]);

      expect(result.currencyPrices).toEqual([{ id: 'ripple', price: 1.3 }]);
    });

    it('omits coins the market does not list against USDT', async () => {
      get.mockReturnValue(of(okResponse(EXCHANGE_TICKERS_FIXTURE)));

      // Coinbase has no BNB/USDT pair; it must be absent, not zero-priced.
      const result = await service.getMarketPrices(['bitcoin', 'binancecoin']);

      expect(result.currencyPrices.map((c) => c.id)).toEqual(['bitcoin']);
    });

    it('requests the given market with comma-separated coin ids', async () => {
      get.mockReturnValue(of(okResponse(EXCHANGE_TICKERS_FIXTURE)));

      await service.getMarketPrices(['bitcoin', 'ethereum'], 'binance');

      expect(get).toHaveBeenCalledWith('/api/v3/exchanges/binance/tickers', {
        params: { coin_ids: 'bitcoin,ethereum' },
      });
    });

    it('short-circuits without calling the API for an empty list', async () => {
      const result = await service.getMarketPrices([]);

      expect(result).toEqual({ marketId: 'gdax', currencyPrices: [] });
      expect(get).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('translates a 429 into a retryable ServiceUnavailableException', async () => {
      jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      const error = new AxiosError('Request failed');
      error.response = { status: 429 } as AxiosResponse;
      get.mockReturnValue(throwError(() => error));

      await expect(service.getCoinsFromMarket(5)).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    });
  });
});
