import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { Currency, CurrencyDocument } from './price.schema';
import { RecordCurrencyDto } from 'src/prices/dto/record-price.dto';

@Injectable()
export class PriceRepository {
  constructor(
    @InjectModel(Currency.name)
    private readonly currencyModel: Model<CurrencyDocument>,
  ) {}

  async record(dto: RecordCurrencyDto): Promise<Currency> {
    return this.currencyModel
      .findOneAndUpdate(
        // Key on the currency alone: market cap moves every run, so including
        // it here would insert a new row each time instead of refreshing one.
        { id: dto.id },
        {
          $set: {
            symbol: dto.symbol.toUpperCase(),
            currentPrice: dto.currentPrice,
            marketCap: dto.marketCap,
            marketCapRank: dto.marketCapRank,
            totalVolume: dto.totalVolume,
          },
        },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
      )
      .lean<Currency>()
      .exec();
  }

  /**
   * The most recently recorded currencies, presented highest market cap first.
   *
   * `updatedAt` ordering picks the latest aggregation snapshot; the in-memory
   * re-sort is presentation only, so it must not mutate the queried array.
   */
  async findTopCurrencies(limit = 5): Promise<RecordCurrencyDto[]> {
    const currencies = await this.currencyModel
      .find()
      .sort({ updatedAt: -1 })
      .limit(limit)
      .lean<Currency[]>()
      .exec();

    const sortedCurrencies = currencies.toSorted(
      (a, b) => b.marketCap - a.marketCap,
    );
    return sortedCurrencies.map((currency) => ({
      id: currency.id,
      symbol: currency.symbol,
      currentPrice: currency.currentPrice,
      marketCap: currency.marketCap,
      marketCapRank: currency.marketCapRank,
      totalVolume: currency.totalVolume,
    }));
  }
}
