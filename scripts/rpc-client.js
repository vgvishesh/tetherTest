const RPC = require('@hyperswarm/rpc');

const [publicKey, ...args] = process.argv.slice(2);

if (!publicKey) {
  console.error('usage: node scripts/rpc-client.js <serverPublicKey> [pair ...]');
  console.error('the server logs its public key at startup');
  process.exit(1);
}

// Accept "btc eth", "btc,eth" or a quoted '["btc","eth"]'.
const parsed = args
  .flatMap((arg) => arg.split(','))
  .map((pair) => pair.replace(/["'[\]\s]/g, ''))
  .filter(Boolean);
const pairs = parsed.length > 0 ? parsed : ['btc', 'eth'];
const rpc = new RPC();

async function call(method, payload) {
  const response = await rpc.request(
    Buffer.from(publicKey, 'hex'),
    method,
    Buffer.from(JSON.stringify(payload)),
  );
  return JSON.parse(response.toString('utf8'));
}

async function main() {
  const to = Date.now();
  const from = to - 24 * 60 * 60 * 1000;

  console.log(`\ngetLatestPrices ${JSON.stringify(pairs)}`);
  console.table(await call('getLatestPrices', { pairs }));

  console.log(
    `\ngetHistoricalPrices ${JSON.stringify(pairs)} ${new Date(from).toISOString()} -> ${new Date(to).toISOString()}`,
  );
  console.table(await call('getHistoricalPrices', { pairs, from, to }));
}

main()
  .catch((error) => {
    console.error('\nfailed:', error.message);
    process.exitCode = 1;
  })
  .finally(() => rpc.destroy({ force: true }));
