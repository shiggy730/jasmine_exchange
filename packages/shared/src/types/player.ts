export type Portfolio = Record<string, number>; // plantId → seedCount

export interface Player {
  id: string;
  name: string;
  goldBalance: number;
  portfolio: Portfolio;
  prevDayPortfolioValue: number | null;
}
