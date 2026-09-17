Q1 — MongoDB Schema Design
Describe the schema/collection structure you chose for storing price data. Why did you design
it this way? What trade-offs did you consider (e.g. document size, query patterns, indexing)?
Answer: There are 3 collections in collections that I am using:
1. TopCurrencies: to store the top currencies.
2. PriceHistory: to store the historic prices whenever we fetch the top currencies
3. AggregationRuns: to store the status of the runs. 

TopCurrencies is the collection that just returns the top N latest modified currencies, we store only the top N currencies here of each scheduled/triggered run. This makes it fast to lookup top N currencies while reading and serving requests. 
Schema: price-aggregator/src/database/price.schema.ts

PriceHistory: We just dump all the price points of each run for all the fetch currencies here. So that we can server the price points in time range reqeusts. 
schema: price-aggregator/src/database/price-history.schema.ts


Q2 — Scheduling Approach
What library or mechanism did you use for scheduling the pipeline (e.g. node-cron,
setInterval, a job queue, something else)? Why did you pick that over the alternatives?
What would you change if this needed to run across multiple instances?
Answer: For now I have used setInterval, as this dint include any exteranl dependency and the tirgger timing dint not include complex scheduling like daywise or on specific days of month/week. This also works well if we need to run a job periodically after every N seconds, and comes into action as soon as the server restarts. 
If this had to be run on multiple servers, we can still use the same mechanism until the schedule requirement do not become complex, to be able to synchronise between multiple instances we will have to use a centralized coordination service like redis, so that multiple instances to not trigger this at the same instance. In redis we need to store the last rum time, and current run status. If after a setInterval invoke, the runner checks the currentTime > lastRunTime + N secs, and currentStatus = NotRunning, then it goes ahead and runs. 

Q3 — Data Quality & Edge Cases
What data quality issues did you anticipate or encounter? How does your code handle them?
Give at least two concrete examples.
- Not all the coins that are returned in the /coins/markets api, are present in all the exchanges returned in the /exchanges api. As a result we wont be able to get the prices off those exchanes. My code handles it by using the price returned in the /coins/markets as one of the data point and peg it agains the tether. 
- There is isStale flag in ``/exchanges/${marketId}/tickers` api, if this flag is set to true the prices are stale. For now, my code does not take this flag's value into consideration and still treats the response as valid price. Reason for this choice is this flag is mostly false in the response. 

Q4 — Hyperswarm RPC - Optional
Had you used Hyperswarm RPC (or any Holepunch libraries) before this task? Describe
briefly how you approached learning / integrating it. What surprised you or what would you do
differently next time?
I followed the npm docs and with little help from AI was able to understand the api contracts. The key was to make it work well with NEST js framework, which took some time. The address is a public key, was quite surprising for me. 

Q5 — Testing Strategy
Describe your testing approach. What did you prioritise testing and why? If you had more
time, what additional tests would you add?
I performed e2e tests via postman manually for the rest server, and for the RPC server i just wrote a simple js client and called the methods a few times. I had also written mocked unit tests for the services with code logic. 

Q6 — Production Readiness
If this service were going to production, what would you add or change? Think about: error
handling, logging, monitoring, deployment, scaling, security.
For prdocution, I need to add monitoring, ci/cd, using cloud for setting env vars, better debug logging, enabling request tracing. This service cannot run on multiple instances bec of the approach taken for scheduling, would use redis to coordinate with other instances, and will also use Caching depending upon the request throughput and the latencies to maintain, and also reduce load on database.

Q7 — Dependencies & Tooling
List the key npm packages you used (beyond the ones specified in the requirements). For
each one, briefly explain why you chose it over alternatives.
NestJs: A good framework for writing TS code in Nodejs
axios: for enabling REST reqeusts
class-validator: for writing annotators to validate the request payloads
