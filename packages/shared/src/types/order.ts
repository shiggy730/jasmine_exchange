import type { Player } from './player.js';
import type { Trade } from './trade.js';

export type OrderSide = 'bid' | 'ask';
export type OrderStatus = 'open' | 'partially_filled' | 'filled' | 'cancelled';

export interface Order {
  id: string;
  playerId: string;
  plantId: string;
  type: OrderSide;
  price: number;
  seedCount: number;
  filledCount: number;
  status: OrderStatus;
  createdAt: number;
  updatedAt: number;
}

export interface PlaceOrderRequest {
  playerId: string;
  plantId: string;
  type: OrderSide;
  price: number;
  seedCount: number;
}

export interface OrderResult {
  status: 'placed' | 'partially_filled' | 'filled' | 'rejected';
  order?: Order;
  trades?: Trade[];
  reason?: string;
  updatedPlayer?: Player;
}
