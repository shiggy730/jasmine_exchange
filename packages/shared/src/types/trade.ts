export interface Trade {
  id: string;
  plantId: string;
  bidOrderId: string;
  askOrderId: string;
  buyerId: string;
  sellerId: string;
  price: number;
  seedCount: number;
  executedAt: number;
}
