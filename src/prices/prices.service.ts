import { Injectable, Logger } from '@nestjs/common';
import type { RecordCurrencyDto } from './dto/record-price.dto';
import type { RecordPricePointDto } from './dto/record-price-point.dto';
import type { PricePointDto } from './dto/price-point.dto';
import { AggregationStatus } from '../database/aggregation-run.schema';
import { CoingeckoService } from '../coingecko/coingecko.service';
import { MarketCoin } from '../coingecko/models';
import { PriceRepository } from '../database/price.repo';
import { RunRepository } from '../database/run.repo';
import { PriceHistoryRepository } from '../database/price-history.repo';
import { PriceHistory } from '../database/price-history.schema';

export interface AggregatedPrice {
  symbol: string;
  averagePrice: number;
  sources: number;
  observedAt: Date;
}

type CoinAggregate = {
  total: number;
  sourceCount: number;
  info: MarketCoin;
};

// The enum now lives with the schema that persists it; re-exported here so
// existing importers (the controller) are unaffected.
export { AggregationStatus };

@Injectable()
export class PricesService {
  private readonly logger = new Logger(PricesService.name);
  /** Set while a run is aggregating; lets the scheduler skip overlapping ticks. */
  private activeRun: Promise<void> | null = null;

  constructor(
    private readonly priceRepository: PriceRepository,
    private readonly priceHistoryRepository: PriceHistoryRepository,
    private readonly runRepository: RunRepository,
    private readonly coingeckoService: CoingeckoService,
  ) {}

  isRunInProgress(): boolean {
    return this.activeRun !== null;
  }

  async initializeAggregationRun(): Promise<string> {
    const runId = crypto.randomUUID();
    await this.runRepository.updateRunStatus(runId, AggregationStatus.PENDING);
    this.activeRun = this.runAggregation(runId)
      .then(() =>
        this.runRepository.updateRunStatus(runId, AggregationStatus.COMPLETED),
      )
      .catch(async (error: Error) => {
        this.logger.error(`Aggregation run ${runId} failed: ${error.message}`);
        await this.runRepository.updateRunStatus(
          runId,
          AggregationStatus.FAILED,
        );
      })
      .then(() => {
        this.activeRun = null;
      });
    return runId;
  }

  async getRunStatus(runId: string): Promise<AggregationStatus> {
    const run = await this.runRepository.findRun(runId);
    return run?.status ?? AggregationStatus.INVALID;
  }

  async runAggregation(runId: string): Promise<void> {
    const run = await this.runRepository.findRun(runId);
    if (run?.status !== AggregationStatus.PENDING) {
      return;
    }
    await this.runRepository.updateRunStatus(runId, AggregationStatus.RUNNING);

    const coinPriceMap: Map<string, CoinAggregate> = new Map();
    const top5Coins = await this.coingeckoService.getCoinsFromMarket(5);
    const top3Markets = await this.coingeckoService.getTopNMarkets(3);

    top5Coins.forEach((x) => {
      coinPriceMap.set(x.id, {
        sourceCount: 1,
        total: x.currentPrice,
        info: x,
      });
    });

    for (const market of top3Markets) {
      const marketPrices = await this.coingeckoService.getMarketPrices(
        top5Coins.map((coin) => coin.id),
        market.id,
        'USD',
      );

      marketPrices.currencyPrices.forEach((currency) => {
        coinPriceMap.get(currency.id)!.total += currency.price;
        coinPriceMap.get(currency.id)!.sourceCount++;
      });
    }

    const latestTetherPrice = await this.coingeckoService.getTetherPrice();

    const pricePoints: RecordPricePointDto[] = [];

    for (const [id, coin] of coinPriceMap) {
      const averageUSDPrice = coin.total / coin.sourceCount;
      const currentPriceInTether = averageUSDPrice / latestTetherPrice.price;
      await this.priceRepository.record({
        id,
        symbol: coin.info.symbol,
        currentPrice: currentPriceInTether,
        marketCap: coin.info.marketCap,
        marketCapRank: coin.info.marketCapRank,
        totalVolume: coin.info.totalVolume,
      });
      pricePoints.push({
        id,
        symbol: coin.info.symbol,
        price: currentPriceInTether,
      });
    }

    await this.priceHistoryRepository.record(pricePoints);

    await this.runRepository.updateRunStatus(
      runId,
      AggregationStatus.COMPLETED,
    );
  }

  async findTopCurrencies(): Promise<RecordCurrencyDto[]> {
    return this.priceRepository.findTopCurrencies();
  }

  async findPriceHistory(
    fromDate: Date,
    toDate: Date,
    symbol: string,
  ): Promise<PriceHistory[]> {
    return this.priceHistoryRepository.find(fromDate, toDate, symbol);
  }

  async getLatestPrices(pairs: string[]): Promise<PricePointDto[]> {
    const points = await this.priceHistoryRepository.findLatestBySymbols(
      normalizeSymbols(pairs),
    );
    return points.map(toPricePoint);
  }

  async getHistoricalPrices(
    pairs: string[],
    from: number,
    to: number,
  ): Promise<PricePointDto[]> {
    const points = await this.priceHistoryRepository.findBySymbols(
      normalizeSymbols(pairs),
      new Date(from),
      new Date(to),
    );
    return points.map(toPricePoint);
  }
}

function normalizeSymbols(pairs: string[]): string[] {
  return [...new Set(pairs.map((pair) => pair.trim().toLowerCase()))].filter(
    (pair) => pair.length > 0,
  );
}

function toPricePoint(point: PriceHistory): PricePointDto {
  return {
    symbol: point.symbol,
    price: point.price,
    timestamp: point.createdAt.getTime(),
  };
}
