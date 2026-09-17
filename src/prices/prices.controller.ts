import { Controller, Get, Param, Post } from '@nestjs/common';
import { AggregationStatus, PricesService } from './prices.service';
import { RecordCurrencyDto } from './dto/record-price.dto';

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

  @Get('run-status/:runId')
  getRunStatus(@Param('runId') runId: string): Promise<AggregationStatus> {
    return this.prices.getRunStatus(runId);
  }
}
