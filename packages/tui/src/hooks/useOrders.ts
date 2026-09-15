import { useState, useEffect, useCallback } from 'react';
import type { Order } from '@jasmine-exchange/shared';
import { api } from '../api/client.js';

const POLL_MS = 3000;

export function useOrders(playerId: string | null) {
  const [orders, setOrders] = useState<Order[]>([]);

  const refresh = useCallback(async () => {
    if (!playerId) return;
    try {
      const data = await api.getOrders();
      setOrders(data);
    } catch {
      // silently ignore — market poller will surface connectivity errors
    }
  }, [playerId]);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, POLL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  return { orders, refresh };
}
