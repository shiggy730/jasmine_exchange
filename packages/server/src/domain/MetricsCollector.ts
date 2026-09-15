import type { MetricsSnapshot, RouteMetrics } from '@jasmine-exchange/shared';

const WINDOW_SECONDS = 300; // 5 minutes of per-second history, in-memory only
const TPS_WINDOW_SECONDS = 10; // live TPS = average over the last 10s

interface Buckets {
  total: Uint32Array;
  failed: Uint32Array;
  /** Epoch-second each slot currently represents; a mismatch means "not written this rotation" (treat as 0). */
  epoch: Int32Array;
}

function makeBuckets(): Buckets {
  return {
    total: new Uint32Array(WINDOW_SECONDS),
    failed: new Uint32Array(WINDOW_SECONDS),
    epoch: new Int32Array(WINDOW_SECONDS).fill(-1),
  };
}

function recordInto(buckets: Buckets, nowSecond: number, failed: boolean): void {
  const idx = nowSecond % WINDOW_SECONDS;
  if (buckets.epoch[idx] !== nowSecond) {
    buckets.total[idx] = 0;
    buckets.failed[idx] = 0;
    buckets.epoch[idx] = nowSecond;
  }
  buckets.total[idx]! += 1;
  if (failed) buckets.failed[idx]! += 1;
}

function sumWindow(
  buckets: Buckets,
  nowSecond: number,
  windowSize: number,
  field: 'total' | 'failed',
): number {
  let sum = 0;
  for (let i = 0; i < windowSize; i++) {
    const sec = nowSecond - i;
    const idx = ((sec % WINDOW_SECONDS) + WINDOW_SECONDS) % WINDOW_SECONDS;
    if (buckets.epoch[idx] === sec) sum += buckets[field][idx]!;
  }
  return sum;
}

function series(
  buckets: Buckets,
  nowSecond: number,
  length: number,
  field: 'total' | 'failed',
): number[] {
  const out: number[] = [];
  for (let i = length - 1; i >= 0; i--) {
    const sec = nowSecond - i;
    const idx = ((sec % WINDOW_SECONDS) + WINDOW_SECONDS) % WINDOW_SECONDS;
    out.push(buckets.epoch[idx] === sec ? buckets[field][idx]! : 0);
  }
  return out;
}

interface RouteEntry {
  method: string;
  route: string;
  buckets: Buckets;
}

/**
 * In-memory HTTP metrics, fed by an onResponse hook. Resets on restart by design —
 * this is live operational data, not history (see the "trades"/"price_history" tables
 * in Database & migrations / Data retention for what's actually kept).
 */
export class MetricsCollector {
  private readonly routes = new Map<string, RouteEntry>();
  private readonly global = makeBuckets();

  record(method: string, route: string, statusCode: number): void {
    const nowSecond = Math.floor(Date.now() / 1000);
    const failed = statusCode >= 400;
    const key = `${method} ${route}`;

    let entry = this.routes.get(key);
    if (!entry) {
      entry = { method, route, buckets: makeBuckets() };
      this.routes.set(key, entry);
    }
    recordInto(entry.buckets, nowSecond, failed);
    recordInto(this.global, nowSecond, failed);
  }

  snapshot(): MetricsSnapshot {
    const nowSecond = Math.floor(Date.now() / 1000);

    const routes: RouteMetrics[] = [...this.routes.values()]
      .map((entry) => {
        const recentTotal = sumWindow(entry.buckets, nowSecond, TPS_WINDOW_SECONDS, 'total');
        return {
          method: entry.method,
          route: entry.route,
          tps: recentTotal / TPS_WINDOW_SECONDS,
          total: sumWindow(entry.buckets, nowSecond, WINDOW_SECONDS, 'total'),
          failed: sumWindow(entry.buckets, nowSecond, WINDOW_SECONDS, 'failed'),
        };
      })
      .sort((a, b) => a.route.localeCompare(b.route) || a.method.localeCompare(b.method));

    return {
      routes,
      totalCallsSeries: series(this.global, nowSecond, WINDOW_SECONDS, 'total'),
      failedCallsSeries: series(this.global, nowSecond, WINDOW_SECONDS, 'failed'),
      bucketSeconds: 1,
    };
  }
}
