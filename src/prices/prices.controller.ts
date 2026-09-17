import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { AggregationStatus, PricesService } from './prices.service';
import { RecordCurrencyDto } from './dto/record-price.dto';
import { PriceHistoryQueryDto } from './dto/price-history-query.dto';
import { PriceHistory } from '../database/price-history.schema';

@Controller('prices')
export class PricesController {
  constructor(private readonly prices: PricesService) {}

  @Post(`run-aggregation`)
  runAggregation(): Promise<string> {
    return this.prices.initializeAggregationRun();
  }

  @Get('top-currencies')
  getTopCurrencies(): Promise<RecordCurrencyDto[]> {
    return this.prices.findTopCurrencies();
  }

  @Get('history/:symbol')
  getPriceHistory(
    @Param('symbol') symbol: string,
    @Query() query: PriceHistoryQueryDto,
  ): Promise<PriceHistory[]> {
    return this.prices.findPriceHistory(query.fromDate, query.toDate, symbol);
  }

  @Get('run-status/:runId')
  getRunStatus(@Param('runId') runId: string): Promise<AggregationStatus> {
    return this.prices.getRunStatus(runId);
  }
}
