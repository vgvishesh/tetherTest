import { IsNumber, IsString, Min, MinLength } from 'class-validator';

export class RecordPricePointDto {
  @IsString()
  @MinLength(1)
  id!: string;

  @IsString()
  @MinLength(1)
  symbol!: string;

  @IsNumber()
  @Min(0)
  price!: number;
}
