export interface PricePoint {
  price: number;
  timestamp: number;
}

export interface Plant {
  id: string;
  name: string;
  ticker: string;
  currentPrice: number;
  prevDayClose: number | null;
  priceHistory: PricePoint[];
  totalSupply: number;
  bestBid: number | null;
  bestAsk: number | null;
}
