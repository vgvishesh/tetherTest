export interface DatabaseConfig {
  uri: string;
  dbName?: string;
  maxPoolSize: number;
  serverSelectionTimeoutMS: number;
  autoIndex: boolean;
}

export interface CoingeckoConfig {
  baseUrl: string;
  apiKey?: string;
  timeoutMs: number;
}

export interface AggregationConfig {
  /** Gap between scheduled aggregation runs, in milliseconds. */
  intervalMs: number;
  /** Set AGGREGATION_ENABLED=false to boot the server without the scheduler. */
  enabled: boolean;
}

export interface AppConfig {
  nodeEnv: string;
  port: number;
  database: DatabaseConfig;
  coingecko: CoingeckoConfig;
  aggregation: AggregationConfig;
}

/**
 * Single place where raw env vars become typed config. Inject with
 * `ConfigService<AppConfig, true>` and read with `config.get('database', { infer: true })`.
 */
export default (): AppConfig => {
  const nodeEnv = process.env.NODE_ENV ?? 'development';

  return {
    nodeEnv,
    port: Number(process.env.PORT ?? 3000),
    database: {
      uri:
        process.env.MONGODB_URI ?? 'mongodb://localhost:27017/price-aggregator',
      dbName: process.env.MONGODB_DB_NAME || undefined,
      maxPoolSize: Number(process.env.MONGODB_MAX_POOL_SIZE ?? 10),
      serverSelectionTimeoutMS: Number(
        process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS ?? 5000,
      ),
      // Index sync on boot is convenient in dev, a foot-gun under production load.
      autoIndex: process.env.MONGODB_AUTO_INDEX
        ? process.env.MONGODB_AUTO_INDEX === 'true'
        : nodeEnv !== 'production',
    },
    coingecko: {
      baseUrl: process.env.COINGECKO_BASE_URL ?? 'https://api.coingecko.com/',
      apiKey: process.env.COINGECKO_API_KEY || undefined,
      timeoutMs: Number(process.env.COINGECKO_TIMEOUT_MS ?? 10000),
    },
    aggregation: {
      intervalMs: Number(process.env.AGGREGATION_INTERVAL_MS ?? 30000),
      enabled: process.env.AGGREGATION_ENABLED
        ? process.env.AGGREGATION_ENABLED === 'true'
        : true,
    },
  };
};
