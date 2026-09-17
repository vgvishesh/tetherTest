import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../config/configuration';
import { PricesService } from './prices.service';

@Injectable()
export class AggregationScheduler
  implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(AggregationScheduler.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prices: PricesService,
    private readonly config: ConfigService<AppConfig, true>,
  ) { }

  onApplicationBootstrap(): void {
    const { enabled, intervalMs } = this.config.get('aggregation', {
      infer: true,
    });

    if (!enabled) {
      this.logger.log('Scheduled aggregation disabled (AGGREGATION_ENABLED)');
      return;
    }

    this.timer = setInterval(() => void this.tick(), intervalMs);
    this.logger.log(`Scheduled aggregation every ${intervalMs}ms`);
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  private async tick(): Promise<void> {
    // A run slower than the interval would otherwise pile up more runs on top
    // of it; skip this tick instead and pick up on the next one.
    if (this.prices.isRunInProgress()) {
      this.logger.warn('Previous aggregation run still in flight, skipping');
      return;
    }

    try {
      const runId = await this.prices.initializeAggregationRun();
      this.logger.log(`Started scheduled aggregation run ${runId}`);
    } catch (error) {
      this.logger.error(
        `Failed to start scheduled aggregation run: ${(error as Error).message}`,
      );
    }
  }
}
