import { Injectable, Logger } from '@nestjs/common';
import type { RecordCurrencyDto } from './dto/record-price.dto';
import { AggregationStatus } from '../database/aggregation-run.schema';
import { CoingeckoService } from 'src/coingecko/coingecko.service';
import { MarketCoin } from 'src/coingecko/models';
import { PriceRepository } from 'src/database/price.repo';
import { RunRepository } from 'src/database/run.repo';

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
    private readonly runRepository: RunRepository,
    private readonly coingeckoService: CoingeckoService,
  ) { }

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

    for (const market of top3Markets) {
      const marketPrices = await this.coingeckoService.getMarketPrices(
        top5Coins.map((coin) => coin.id),
        market.id,
        'USD',
      );

      marketPrices.currencyPrices.forEach((currency) => {
        if (!coinPriceMap.has(currency.id)) {
          coinPriceMap.set(currency.id, {
            total: 0,
            sourceCount: 0,
            info: top5Coins.find((coin) => coin.id === currency.id)!,
          });
        }
        coinPriceMap.get(currency.id)!.total += currency.price;
        coinPriceMap.get(currency.id)!.sourceCount++;
      });
    }

    const latestTetherPrice = await this.coingeckoService.getTetherPrice();

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
    }

    await this.runRepository.updateRunStatus(
      runId,
      AggregationStatus.COMPLETED,
    );
  }

  async findTopCurrencies(): Promise<RecordCurrencyDto[]> {
    return this.priceRepository.findTopCurrencies();
  }
}
