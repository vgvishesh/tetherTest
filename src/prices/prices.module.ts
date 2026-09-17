import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CoingeckoModule } from '../coingecko/coingecko.module';
import { AggregationScheduler } from './aggregation.scheduler';
import { PricesController } from './prices.controller';
import { PricesService } from './prices.service';
import { PriceRepository } from '../database/price.repo';
import { RunRepository } from '../database/run.repo';
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
    ]),
    CoingeckoModule,
  ],
  controllers: [PricesController],
  providers: [
    PricesService,
    PriceRepository,
    RunRepository,
    AggregationScheduler,
  ],
  exports: [PricesService],
})
export class PricesModule { }
