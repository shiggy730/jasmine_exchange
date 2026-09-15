import type {
  Plant,
  Player,
  MarketSummary,
  PlaceOrderRequest,
  OrderResult,
  Order,
  Trade,
  AuthResult,
} from '@jasmine-exchange/shared';

const BASE_URL = process.env['API_URL'] ?? 'http://localhost:3000';

let authToken: string | null = null;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

  const res = await fetch(`${BASE_URL}${path}`, { headers, ...init });
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // response wasn't JSON — fall back to the plain status message
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

export const api = {
  setAuthToken(token: string | null): void {
    authToken = token;
  },

  getPlants(): Promise<MarketSummary> {
    return request<MarketSummary>('/plants');
  },

  getPlant(id: string): Promise<Plant> {
    return request<Plant>(`/plants/${id}`);
  },

  signup(name: string, password: string): Promise<AuthResult> {
    return request<AuthResult>('/players/signup', {
      method: 'POST',
      body: JSON.stringify({ name, password }),
    });
  },

  login(name: string, password: string): Promise<AuthResult> {
    return request<AuthResult>('/players/login', {
      method: 'POST',
      body: JSON.stringify({ name, password }),
    });
  },

  changePassword(name: string, currentPassword: string, newPassword: string): Promise<AuthResult> {
    return request<AuthResult>('/players/change-password', {
      method: 'POST',
      body: JSON.stringify({ name, currentPassword, newPassword }),
    });
  },

  getPlayer(id: string): Promise<Player> {
    return request<Player>(`/players/${id}`);
  },

  resetPlayer(id: string): Promise<Player> {
    return request<Player>(`/players/${id}/reset`, { method: 'POST', body: '{}' });
  },

  placeOrder(req: PlaceOrderRequest): Promise<OrderResult> {
    return request<OrderResult>('/orders', {
      method: 'POST',
      body: JSON.stringify(req),
    });
  },

  getOrders(): Promise<Order[]> {
    return request<Order[]>('/orders');
  },

  cancelOrder(orderId: string): Promise<{ success: boolean }> {
    return request<{ success: boolean }>(`/orders/${orderId}`, {
      method: 'DELETE',
    });
  },

  getTrades(opts?: { plantId?: string; limit?: number; offset?: number }): Promise<Trade[]> {
    const params = new URLSearchParams();
    if (opts?.plantId) params.set('plantId', opts.plantId);
    if (opts?.limit !== undefined) params.set('limit', String(opts.limit));
    if (opts?.offset !== undefined) params.set('offset', String(opts.offset));
    const qs = params.toString() ? `?${params}` : '';
    return request<Trade[]>(`/trades${qs}`);
  },
};
