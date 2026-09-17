# price-aggregator

Aggregates top-5 currency prices across the top-3 CoinGecko markets, denominates them
in USDT, stores them in MongoDB, and exposes the stored data over **REST** and
**Hyperswarm RPC**. Both servers run in the same process.

## Setup

Requires Node.js 20.19+ (Mongoose 9's floor) and a reachable MongoDB.

```bash
npm install
cp .env.example .env   # then set COINGECKO_API_KEY
npm run start:dev      # or: npm run build && npm run start:prod
```

On boot the app logs the HTTP port and the RPC public key:

```
[RpcServer] Registered RPC method getLatestPrices
[RpcServer] Registered RPC method getHistoricalPrices
[RpcServer] RPC server listening on e734ea6c...6b58
```

Aggregation runs on a timer (`AGGREGATION_INTERVAL_MS`) once the app has booted;
each run writes a snapshot to `TopCurrencies` and appends points to `PriceHistory`.

## REST API

Base URL `http://localhost:$PORT`.

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/prices/run-aggregation` | Starts an aggregation run, returns its `runId` |
| `GET` | `/prices/run-status/:runId` | `pending` \| `running` \| `completed` \| `failed` \| `invalid` |
| `GET` | `/prices/top-currencies` | Latest snapshot per currency, by market cap |
| `GET` | `/prices/history/:symbol?fromDate=&toDate=` | Stored price points in a range, newest first |

```bash
curl -X POST localhost:3000/prices/run-aggregation
curl localhost:3000/prices/top-currencies
curl "localhost:3000/prices/history/btc?fromDate=2026-09-17T00:00:00.000Z&toDate=2026-09-18T00:00:00.000Z"
```

`fromDate`/`toDate` are required and accept anything `new Date(string)` parses —
use ISO 8601 with an explicit `Z` (`2026-09-17T00:00:00.000Z`). A bare
`2026-09-17` is UTC midnight; a zone-less `2026-09-17T00:00:00` is read in the
server's local time. Epoch milliseconds are rejected. The range is inclusive at
both ends, symbol case does not matter, and unknown query params are rejected
with `400`.

## Hyperswarm RPC

Requests and responses are JSON buffers over [`@hyperswarm/rpc`](https://www.npmjs.com/package/@hyperswarm/rpc).

| Method | Payload | Returns |
| --- | --- | --- |
| `getLatestPrices` | `{ pairs: string[] }` | Most recent point per symbol |
| `getHistoricalPrices` | `{ pairs: string[], from: number, to: number }` | All points in the range, newest first per symbol |

`pairs` are currency symbols (`["btc", "eth"]`), matched case-insensitively
against the `PriceHistory` collection; symbols with no stored data are simply
absent from the response. `from`/`to` are epoch milliseconds, inclusive. Both
methods return `PricePointDto[]`:

```json
[{ "symbol": "btc", "price": 110.5, "timestamp": 1789646763755 }]
```

Client:

```js
const RPC = require('@hyperswarm/rpc');

const rpc = new RPC();
const publicKey = Buffer.from('<public key from the server log>', 'hex');

const call = async (method, payload) => {
  const raw = await rpc.request(publicKey, method, Buffer.from(JSON.stringify(payload)));
  return JSON.parse(raw.toString('utf8'));
};

await call('getLatestPrices', { pairs: ['btc', 'eth'] });
await call('getHistoricalPrices', { pairs: ['btc'], from: Date.now() - 3600_000, to: Date.now() });

await rpc.destroy();
```

Two things to know:

- The keypair is generated per boot, so the public key changes on every restart.
  Clients read it from the server log.
- `protomux-rpc` masks handler errors on the wire as `REQUEST_ERROR: Request
  failed`; the real reason (e.g. `Invalid RPC payload: pairs should not be
  empty`) is only in the server log.

## Environment variables

Loaded from `.env.local`, then `.env`, and validated at boot (`src/config/env.validation.ts`).

| Variable | Default | Description |
| --- | --- | --- |
| `NODE_ENV` | `development` | `development` \| `production` \| `test` |
| `PORT` | `3000` | HTTP port |
| `MONGODB_URI` | `mongodb://localhost:27017/price-aggregator` | Connection string |
| `MONGODB_DB_NAME` | from URI | Overrides the database in the URI |
| `MONGODB_MAX_POOL_SIZE` | `10` | Mongoose connection pool size |
| `MONGODB_SERVER_SELECTION_TIMEOUT_MS` | `5000` | Fail fast when Mongo is unreachable |
| `MONGODB_AUTO_INDEX` | `true` outside production | Sync indexes on boot |
| `COINGECKO_BASE_URL` | `https://api.coingecko.com/` | Demo keys only work against this host |
| `COINGECKO_API_KEY` | — | Free demo key; without it you share an IP-wide quota and hit `429` fast |
| `COINGECKO_TIMEOUT_MS` | `10000` | Per-request HTTP timeout |
| `COINGECKO_MAX_RETRIES` | `5` | Retries after the first attempt |
| `COINGECKO_RETRY_BASE_DELAY_MS` | `1000` | Backoff base; the delay doubles each retry |
| `AGGREGATION_ENABLED` | `true` | `false` boots without the scheduler (manual runs only) |
| `AGGREGATION_INTERVAL_MS` | `30000` | Gap between scheduled runs; minimum `1000` |
| `RPC_ENABLED` | `true` | `false` boots without the RPC server |
| `RPC_BOOTSTRAP` | public DHT | Comma-separated `host:port` DHT bootstrap nodes |

## Tests

```bash
npm test              # 35 unit tests, all external deps mocked
npm run test:cov      # with a coverage report
npm run test:watch    # re-run on change
npm run lint
```

No MongoDB or CoinGecko access is needed — `CoingeckoService` is driven through a
mocked `HttpService`, and `PricesService` through mocked repositories.

| Suite | Covers |
| --- | --- |
| `coingecko.service.spec.ts` | Response mapping to camelCase models, USDT-pair filtering, stale/anomaly rejection, retry with exponential backoff |
| `prices.service.spec.ts` | Aggregation fallbacks when coins are missing from the top-3 markets, run status transitions |
| `app.controller.spec.ts` | Scaffold smoke test |

### If watchman errors appear

Jest is configured with `"watchman": false` in `package.json`. A stale Homebrew
`watchman` (linked against an `icu4c` version that no longer exists) otherwise
aborts the run before any test executes:

```
Watchman: watchman --no-pretty get-sockname returned with exit code=null, signal=SIGABRT
dyld: Library not loaded: /opt/homebrew/opt/icu4c/lib/libicudata.73.dylib
```

Repair it with `brew reinstall watchman`, or leave the flag as-is — Jest's own
crawler is used instead, which is fine at this project size.
