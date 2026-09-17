/** Outbound shape for a single stored PriceHistory point. */
export class PricePointDto {
  symbol!: string;
  price!: number;
  timestamp!: number;
}
