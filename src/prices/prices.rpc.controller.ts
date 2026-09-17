import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { RpcServer } from '../rpc/rpc.server';
import { parseRpcPayload } from '../rpc/rpc.validation';
import {
  GetHistoricalPricesDto,
  GetLatestPricesDto,
} from './dto/price-query.dto';
import { PricePointDto } from './dto/price-point.dto';
import { PricesService } from './prices.service';

/** Hyperswarm RPC surface for the stored price history. */
@Injectable()
export class PricesRpcController implements OnApplicationBootstrap {
  constructor(
    private readonly rpc: RpcServer,
    private readonly prices: PricesService,
  ) {}

  onApplicationBootstrap(): void {
    this.rpc.respond('getLatestPrices', (payload) =>
      this.getLatestPrices(payload),
    );
    this.rpc.respond('getHistoricalPrices', (payload) =>
      this.getHistoricalPrices(payload),
    );
  }

  private getLatestPrices(payload: unknown): Promise<PricePointDto[]> {
    const { pairs } = parseRpcPayload(GetLatestPricesDto, payload);
    return this.prices.getLatestPrices(pairs);
  }

  private getHistoricalPrices(payload: unknown): Promise<PricePointDto[]> {
    const { pairs, from, to } = parseRpcPayload(
      GetHistoricalPricesDto,
      payload,
    );
    return this.prices.getHistoricalPrices(pairs, from, to);
  }
}
