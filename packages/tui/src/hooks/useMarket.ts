import { useState, useEffect } from 'react';
import type { MarketSummary } from '@jasmine-exchange/shared';
import { api } from '../api/client.js';

const POLL_MS = 3000;

export function useMarket() {
  const [market, setMarket] = useState<MarketSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const data = await api.getPlants();
        if (!cancelled) {
          setMarket(data);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to fetch market data');
        }
      }
    }

    poll();
    const timer = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  return { market, error };
}
