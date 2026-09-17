import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CoingeckoModule } from '../coingecko/coingecko.module';
import { RpcModule } from '../rpc/rpc.module';
import { AggregationScheduler } from './aggregation.scheduler';
import { PricesController } from './prices.controller';
import { PricesRpcController } from './prices.rpc.controller';
import { PricesService } from './prices.service';
import { PriceRepository } from '../database/price.repo';
import { RunRepository } from '../database/run.repo';
import { PriceHistoryRepository } from '../database/price-history.repo';
import {
  PriceHistory,
  PriceHistorySchema,
} from '../database/price-history.schema';
import { CurrencySchema, Currency } from '../database/price.schema';
import {
  AggregationRun,
  AggregationRunSchema,
} from '../database/aggregation-run.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Currency.name, schema: CurrencySchema },
      { name: AggregationRun.name, schema: AggregationRunSchema },
      { name: PriceHistory.name, schema: PriceHistorySchema },
    ]),
    CoingeckoModule,
    RpcModule,
  ],
  controllers: [PricesController],
  providers: [
    PricesService,
    PriceRepository,
    RunRepository,
    PriceHistoryRepository,
    AggregationScheduler,
    PricesRpcController,
  ],
  exports: [PricesService],
})
export class PricesModule {}
