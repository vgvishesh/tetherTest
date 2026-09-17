import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  AggregationRun,
  AggregationRunDocument,
  AggregationStatus,
} from './aggregation-run.schema';

@Injectable()
export class RunRepository {
  constructor(
    @InjectModel(AggregationRun.name)
    private readonly aggregationRunModel: Model<AggregationRunDocument>,
  ) {}

  async findRun(runId: string): Promise<AggregationRun | null> {
    return this.aggregationRunModel
      .findOne({ runId })
      .lean<AggregationRun>()
      .exec();
  }

  async updateRunStatus(
    runId: string,
    status: AggregationStatus,
  ): Promise<AggregationRun> {
    return this.aggregationRunModel
      .findOneAndUpdate(
        { runId },
        { $set: { status } },
        {
          upsert: true,
          returnDocument: 'after',
          setDefaultsOnInsert: true,
          runValidators: true,
        },
      )
      .lean<AggregationRun>()
      .exec();
  }
}
