import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

export type PriceHistoryDocument = HydratedDocument<PriceHistory>;

@Schema({
  collection: 'PriceHistory',
  timestamps: { createdAt: true, updatedAt: false },
  versionKey: false,
})
export class PriceHistory {
  @Prop({ required: true, trim: true, uppercase: true })
  id!: string;

  @Prop({ required: true, trim: true, lowercase: true })
  symbol!: string;

  @Prop({ required: true, type: Number, min: 0 })
  price!: number;

  createdAt!: Date;
}

export const PriceHistorySchema = SchemaFactory.createForClass(PriceHistory);

// Serves the range scan: equality on symbol, then createdAt newest first.
PriceHistorySchema.index({ symbol: 1, createdAt: -1 });
