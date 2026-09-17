import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '../config/configuration';
import { CoingeckoService } from './coingecko.service';

@Module({
  imports: [
    HttpModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) => {
        const coingecko = config.get('coingecko', { infer: true });

        return {
          baseURL: coingecko.baseUrl,
          timeout: coingecko.timeoutMs,
          headers: {
            accept: 'application/json',
            // Demo keys only work against api.coingecko.com; Pro keys use a
            // different host and header (error 10011 if they are crossed).
            ...(coingecko.apiKey
              ? { 'x-cg-demo-api-key': coingecko.apiKey }
              : {}),
          },
        };
      },
    }),
  ],
  providers: [CoingeckoService],
  exports: [CoingeckoService],
})
export class CoingeckoModule {}
