import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

export enum AggregationStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  INVALID = 'invalid',
}

/** Statuses a run can actually be stored in. */
export const PERSISTED_STATUSES = Object.values(AggregationStatus).filter(
  (status) => status !== AggregationStatus.INVALID,
);

export type AggregationRunDocument = HydratedDocument<AggregationRun>;

/** One aggregation run: its identifier and where it got to. */
@Schema({ collection: 'AggregationRuns', timestamps: true, versionKey: false })
export class AggregationRun {
  @Prop({ required: true, trim: true })
  runId!: string;

  @Prop({ required: true, type: String, enum: PERSISTED_STATUSES })
  status!: AggregationStatus;

  /**
   * Maintained by Mongoose via `timestamps: true` — never set from the
   * application. createdAt is when the run was queued, updatedAt when it
   * last changed state, so their difference is the run's duration.
   */
  createdAt!: Date;
  updatedAt!: Date;
}

export const AggregationRunSchema =
  SchemaFactory.createForClass(AggregationRun);

// One row per run; makes the status write an idempotent upsert.
AggregationRunSchema.index({ runId: 1 }, { unique: true });
