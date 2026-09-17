import { plainToInstance } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  validateSync,
} from 'class-validator';

export enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

class EnvironmentVariables {
  @IsOptional()
  @IsEnum(Environment)
  NODE_ENV?: Environment;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(65535)
  PORT?: number;

  @IsOptional()
  @Matches(/^mongodb(\+srv)?:\/\//, {
    message: 'MONGODB_URI must start with mongodb:// or mongodb+srv://',
  })
  MONGODB_URI?: string;

  @IsOptional()
  @IsString()
  MONGODB_DB_NAME?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  MONGODB_MAX_POOL_SIZE?: number;

  @IsOptional()
  @IsInt()
  @Min(100)
  MONGODB_SERVER_SELECTION_TIMEOUT_MS?: number;

  @IsOptional()
  @IsBoolean()
  MONGODB_AUTO_INDEX?: boolean;

  @IsOptional()
  @Matches(/^https?:\/\//, {
    message: 'COINGECKO_BASE_URL must be an http(s) URL',
  })
  COINGECKO_BASE_URL?: string;

  @IsOptional()
  @IsString()
  COINGECKO_API_KEY?: string;

  @IsOptional()
  @IsInt()
  @Min(100)
  COINGECKO_TIMEOUT_MS?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  COINGECKO_MAX_RETRIES?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  COINGECKO_RETRY_BASE_DELAY_MS?: number;

  // A sub-second cadence would stampede the CoinGecko quota, so floor it.
  @IsOptional()
  @IsInt()
  @Min(1000)
  AGGREGATION_INTERVAL_MS?: number;

  @IsOptional()
  @IsBoolean()
  AGGREGATION_ENABLED?: boolean;

  @IsOptional()
  @IsBoolean()
  RPC_ENABLED?: boolean;

  @IsOptional()
  @IsString()
  RPC_BOOTSTRAP?: string;
}

export function validate(config: Record<string, unknown>) {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validated, { skipMissingProperties: true });

  if (errors.length > 0) {
    throw new Error(
      `Invalid environment configuration:\n${errors
        .map((e) => `  - ${Object.values(e.constraints ?? {}).join(', ')}`)
        .join('\n')}`,
    );
  }

  return config;
}
