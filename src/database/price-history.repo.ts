import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PriceHistory, PriceHistoryDocument } from './price-history.schema';
import { RecordPricePointDto } from 'src/prices/dto/record-price-point.dto';

@Injectable()
export class PriceHistoryRepository {
  constructor(
    @InjectModel(PriceHistory.name)
    private readonly priceHistoryModel: Model<PriceHistoryDocument>,
  ) {}

  async record(points: RecordPricePointDto[]): Promise<void> {
    if (points.length === 0) {
      return;
    }
    await this.priceHistoryModel.insertMany(points);
  }

  async find(
    fromDate: Date,
    toDate: Date,
    symbol: string,
  ): Promise<PriceHistory[]> {
    return this.priceHistoryModel
      .find({ symbol, createdAt: { $gte: fromDate, $lte: toDate } })
      .sort({ createdAt: -1 })
      .lean<PriceHistory[]>()
      .exec();
  }

  async findLatestBySymbols(symbols: string[]): Promise<PriceHistory[]> {
    if (symbols.length === 0) {
      return [];
    }
    return this.priceHistoryModel
      .aggregate<PriceHistory>([
        { $match: { symbol: { $in: symbols } } },
        { $sort: { symbol: 1, createdAt: -1 } },
        { $group: { _id: '$symbol', latest: { $first: '$$ROOT' } } },
        { $replaceRoot: { newRoot: '$latest' } },
      ])
      .exec();
  }

  async findBySymbols(
    symbols: string[],
    fromDate: Date,
    toDate: Date,
  ): Promise<PriceHistory[]> {
    if (symbols.length === 0) {
      return [];
    }
    return this.priceHistoryModel
      .find({
        symbol: { $in: symbols },
        createdAt: { $gte: fromDate, $lte: toDate },
      })
      .sort({ symbol: 1, createdAt: -1 })
      .lean<PriceHistory[]>()
      .exec();
  }
}
