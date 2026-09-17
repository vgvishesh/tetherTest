import { ArrayNotEmpty, IsArray, IsInt, IsString, Min } from 'class-validator';

export class GetLatestPricesDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  pairs!: string[];
}

export class GetHistoricalPricesDto extends GetLatestPricesDto {
  @IsInt()
  @Min(0)
  from!: number;

  @IsInt()
  @Min(0)
  to!: number;
}
