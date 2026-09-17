import { IsNumber, IsString, Min, MinLength } from 'class-validator';

/**
 * Inbound shape for recording one aggregated currency snapshot.
 *
 * `!` marks each field as definitely assigned: ValidationPipe constructs this
 * via class-transformer rather than a constructor, so TypeScript cannot see
 * the assignment. Timestamps are deliberately absent — Mongoose owns
 * createdAt/updatedAt through `timestamps: true` on the schema.
 */
export class RecordCurrencyDto {
  @IsString()
  @MinLength(1)
  id!: string;

  @IsString()
  @MinLength(1)
  symbol!: string;

  @IsNumber()
  @Min(0)
  currentPrice!: number;

  @IsNumber()
  @Min(0)
  marketCap!: number;

  @IsNumber()
  @Min(0)
  marketCapRank!: number;

  @IsNumber()
  @Min(0)
  totalVolume!: number;
}
