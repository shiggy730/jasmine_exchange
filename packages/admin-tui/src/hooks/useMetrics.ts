import { useState, useEffect } from 'react';
import type { MetricsSnapshot } from '@jasmine-exchange/shared';
import { getMetrics } from '../api/metricsClient.js';

const POLL_MS = 1500;

export function useMetrics(active: boolean) {
  const [snapshot, setSnapshot] = useState<MetricsSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;

    async function poll() {
      try {
        const data = await getMetrics();
        if (!cancelled) {
          setSnapshot(data);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to reach server');
        }
      }
    }

    poll();
    const timer = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [active]);

  return { snapshot, error };
}
