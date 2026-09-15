import { useState, useEffect, useCallback } from 'react';
import type { Player } from '@jasmine-exchange/shared';
import { api } from '../api/client.js';

const POLL_MS = 5000;

export function usePlayer(playerId: string | null, initialPlayer?: Player) {
  const [player, setPlayer] = useState<Player | null>(initialPlayer ?? null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (updated?: Player) => {
    if (updated) {
      setPlayer(updated);
      return;
    }
    if (!playerId) return;
    try {
      const data = await api.getPlayer(playerId);
      setPlayer(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch player');
    }
  }, [playerId]);

  useEffect(() => {
    if (!playerId) return;
    let cancelled = false;

    async function poll() {
      if (cancelled) return;
      try {
        const data = await api.getPlayer(playerId!);
        if (!cancelled) {
          setPlayer(data);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to fetch player');
        }
      }
    }

    poll();
    const timer = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [playerId]);

  return { player, error, refresh };
}
