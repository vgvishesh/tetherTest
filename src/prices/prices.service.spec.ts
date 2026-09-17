import { Test, TestingModule } from '@nestjs/testing';
import { CoingeckoService } from '../coingecko/coingecko.service';
import { AggregationStatus } from '../database/aggregation-run.schema';
import { PriceHistoryRepository } from '../database/price-history.repo';
import { PriceRepository } from '../database/price.repo';
import { RunRepository } from '../database/run.repo';
import type { RecordCurrencyDto } from './dto/record-price.dto';
import type { RecordPricePointDto } from './dto/record-price-point.dto';
import { PricesService } from './prices.service';

const RUN_ID = 'run-1';
const TETHER_PRICE = 0.5; // a USD price divided by this doubles it

const COINS = [
  {
    id: 'bitcoin',
    symbol: 'btc',
    name: 'Bitcoin',
    currentPrice: 100,
    marketCap: 1000,
    marketCapRank: 1,
    totalVolume: 10,
  },
  {
    id: 'ethereum',
    symbol: 'eth',
    name: 'Ethereum',
    currentPrice: 50,
    marketCap: 500,
    marketCapRank: 2,
    totalVolume: 9,
  },
  {
    id: 'tether',
    symbol: 'usdt',
    name: 'Tether',
    currentPrice: 1,
    marketCap: 400,
    marketCapRank: 3,
    totalVolume: 8,
  },
  {
    id: 'binancecoin',
    symbol: 'bnb',
    name: 'BNB',
    currentPrice: 20,
    marketCap: 300,
    marketCapRank: 4,
    totalVolume: 7,
  },
  {
    id: 'ripple',
    symbol: 'xrp',
    name: 'XRP',
    currentPrice: 2,
    marketCap: 200,
    marketCapRank: 5,
    totalVolume: 6,
  },
];

const MARKETS = [
  { id: 'binance', name: 'Binance', trustScore: 10 },
  { id: 'gdax', name: 'Coinbase Exchange', trustScore: 10 },
  { id: 'kraken', name: 'Kraken', trustScore: 10 },
];

const noPrices = (marketId: string) => ({ marketId, currencyPrices: [] });

describe('PricesService', () => {
  let service: PricesService;

  const coingecko = {
    getCoinsFromMarket: jest.fn(),
    getTopNMarkets: jest.fn(),
    getMarketPrices: jest.fn(),
    getTetherPrice: jest.fn(),
  };
  const priceRepository = {
    record: jest.fn(),
    findTopCurrencies: jest.fn(),
  };
  const priceHistoryRepository = {
    record: jest.fn(),
    find: jest.fn(),
    findLatestBySymbols: jest.fn(),
    findBySymbols: jest.fn(),
  };
  const runRepository = {
    findRun: jest.fn(),
    updateRunStatus: jest.fn(),
  };

  /** Currencies handed to PriceRepository.record, in call order. */
  const recorded = (): RecordCurrencyDto[] =>
    (priceRepository.record.mock.calls as [RecordCurrencyDto][]).map(
      ([dto]) => dto,
    );

  /** The single batch handed to PriceHistoryRepository.record. */
  const recordedHistory = (): RecordPricePointDto[] =>
    (
      priceHistoryRepository.record.mock.calls as [RecordPricePointDto[]][]
    )[0][0];

  const priceOf = (id: string) =>
    recorded().find((c) => c.id === id)!.currentPrice;

  beforeEach(async () => {
    jest.clearAllMocks();

    coingecko.getCoinsFromMarket.mockResolvedValue(COINS);
    coingecko.getTopNMarkets.mockResolvedValue(MARKETS);
    coingecko.getTetherPrice.mockResolvedValue({ price: TETHER_PRICE });
    runRepository.findRun.mockResolvedValue({
      runId: RUN_ID,
      status: AggregationStatus.PENDING,
    });
    runRepository.updateRunStatus.mockResolvedValue(undefined);
    priceRepository.record.mockResolvedValue(undefined);
    priceHistoryRepository.record.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PricesService,
        { provide: CoingeckoService, useValue: coingecko },
        { provide: PriceRepository, useValue: priceRepository },
        { provide: PriceHistoryRepository, useValue: priceHistoryRepository },
        { provide: RunRepository, useValue: runRepository },
      ],
    }).compile();

    service = module.get(PricesService);
  });

  describe('coins missing from the top 3 markets', () => {
    it('still prices every coin when no market lists any of them', async () => {
      coingecko.getMarketPrices.mockImplementation(
        (_ids: string[], marketId: string) =>
          Promise.resolve(noPrices(marketId)),
      );

      await service.runAggregation(RUN_ID);

      expect(recorded()).toHaveLength(COINS.length);
      // Falls back to the CoinGecko USD price, converted at the tether rate.
      expect(priceOf('bitcoin')).toBe(100 / TETHER_PRICE);
      expect(priceOf('ethereum')).toBe(50 / TETHER_PRICE);
      expect(priceOf('tether')).toBe(1 / TETHER_PRICE);
      expect(priceOf('binancecoin')).toBe(20 / TETHER_PRICE);
      expect(priceOf('ripple')).toBe(2 / TETHER_PRICE);
      recorded().forEach((currency) => {
        expect(Number.isFinite(currency.currentPrice)).toBe(true);
        expect(currency.currentPrice).toBeGreaterThan(0);
      });
    });

    it('prices covered and uncovered coins in the same run', async () => {
      // Only bitcoin trades on the three markets.
      coingecko.getMarketPrices.mockImplementation(
        (_ids: string[], marketId: string) =>
          Promise.resolve({
            marketId,
            currencyPrices: [{ id: 'bitcoin', price: 110 }],
          }),
      );

      await service.runAggregation(RUN_ID);

      expect(recorded()).toHaveLength(COINS.length);
      // bitcoin: CoinGecko baseline plus three venues -> (100+110+110+110)/4.
      expect(priceOf('bitcoin')).toBe(430 / 4 / TETHER_PRICE);
      // Everything else keeps the CoinGecko price rather than being skipped.
      expect(priceOf('ethereum')).toBe(50 / TETHER_PRICE);
      expect(priceOf('ripple')).toBe(2 / TETHER_PRICE);
    });

    it('averages a coin listed on only one of the three markets', async () => {
      coingecko.getMarketPrices.mockImplementation(
        (_ids: string[], marketId: string) =>
          Promise.resolve(
            marketId === 'binance'
              ? { marketId, currencyPrices: [{ id: 'binancecoin', price: 30 }] }
              : noPrices(marketId),
          ),
      );

      await service.runAggregation(RUN_ID);

      // (20 baseline + 30 from binance) / 2 sources.
      expect(priceOf('binancecoin')).toBe(25 / TETHER_PRICE);
      expect(priceOf('bitcoin')).toBe(100 / TETHER_PRICE);
    });

    it('records a history point for every coin, covered or not', async () => {
      coingecko.getMarketPrices.mockImplementation(
        (_ids: string[], marketId: string) =>
          Promise.resolve(
            marketId === 'kraken'
              ? { marketId, currencyPrices: [{ id: 'ethereum', price: 60 }] }
              : noPrices(marketId),
          ),
      );

      await service.runAggregation(RUN_ID);

      const history = recordedHistory();
      expect(priceHistoryRepository.record).toHaveBeenCalledTimes(1);
      expect(history.map((p) => p.id).sort()).toEqual(
        COINS.map((c) => c.id).sort(),
      );
      expect(history.every((p) => Number.isFinite(p.price))).toBe(true);
      // History mirrors what went into the currencies collection.
      history.forEach((point) => {
        expect(point.price).toBe(priceOf(point.id));
      });
    });

    it('asks every market for all five coin ids', async () => {
      coingecko.getMarketPrices.mockImplementation(
        (_ids: string[], marketId: string) =>
          Promise.resolve(noPrices(marketId)),
      );

      await service.runAggregation(RUN_ID);

      expect(coingecko.getMarketPrices).toHaveBeenCalledTimes(MARKETS.length);
      (
        coingecko.getMarketPrices.mock.calls as [string[], string, string][]
      ).forEach(([ids]) => expect(ids).toEqual(COINS.map((c) => c.id)));
    });
  });

  describe('run lifecycle', () => {
    beforeEach(() => {
      coingecko.getMarketPrices.mockImplementation(
        (_ids: string[], marketId: string) =>
          Promise.resolve(noPrices(marketId)),
      );
    });

    it('moves the run to RUNNING then COMPLETED', async () => {
      await service.runAggregation(RUN_ID);

      expect(runRepository.updateRunStatus.mock.calls).toEqual([
        [RUN_ID, AggregationStatus.RUNNING],
        [RUN_ID, AggregationStatus.COMPLETED],
      ]);
    });

    it('does nothing when the run is not PENDING', async () => {
      runRepository.findRun.mockResolvedValue({
        runId: RUN_ID,
        status: AggregationStatus.COMPLETED,
      });

      await service.runAggregation(RUN_ID);

      expect(coingecko.getCoinsFromMarket).not.toHaveBeenCalled();
      expect(priceRepository.record).not.toHaveBeenCalled();
    });

    it('does nothing when the runId is unknown', async () => {
      runRepository.findRun.mockResolvedValue(null);

      await service.runAggregation(RUN_ID);

      expect(coingecko.getCoinsFromMarket).not.toHaveBeenCalled();
    });
  });
});
