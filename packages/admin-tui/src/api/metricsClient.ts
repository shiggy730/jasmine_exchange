import type { MetricsSnapshot } from '@jasmine-exchange/shared';

const BASE_URL = process.env['API_URL'] ?? 'http://localhost:3000';

export async function getMetrics(): Promise<MetricsSnapshot> {
  const res = await fetch(`${BASE_URL}/admin/metrics`);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return res.json() as Promise<MetricsSnapshot>;
}
