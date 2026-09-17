import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

export type CurrencyDocument = HydratedDocument<Currency>;

/** Latest aggregated market snapshot for one currency. */
@Schema({ collection: 'TopCurrencies', timestamps: true, versionKey: false })
export class Currency {
  @Prop({ required: true, trim: true, uppercase: true })
  id!: string;

  @Prop({ required: true, trim: true, lowercase: true })
  symbol!: string;

  @Prop({ required: true, type: Number, min: 0 })
  currentPrice!: number;

  @Prop({ required: true, type: Number, min: 0 })
  marketCap!: number;

  @Prop({ required: true, type: Number, min: 0 })
  marketCapRank!: number;

  @Prop({ required: true, type: Number, min: 0 })
  totalVolume!: number;

  createdAt!: Date;
  updatedAt!: Date;
}

export const CurrencySchema = SchemaFactory.createForClass(Currency);

CurrencySchema.index({ id: 1 }, { unique: true });
