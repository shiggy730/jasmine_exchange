export interface RouteMetrics {
  method: string;
  route: string;
  /** Requests/sec, averaged over the last ~10s. */
  tps: number;
  /** Total requests recorded for this route within the retained window. */
  total: number;
  /** Failed (status >= 400) requests recorded for this route within the retained window. */
  failed: number;
}

export interface MetricsSnapshot {
  /** One entry per method+route seen since the server started. */
  routes: RouteMetrics[];
  /** Total request counts across all routes, one entry per second, oldest first — this *is* TPS-over-time (1s buckets). */
  totalCallsSeries: number[];
  /** Failed-call counts across all routes, one entry per second, oldest first. */
  failedCallsSeries: number[];
  /** Wall-clock seconds each bucket in the series above spans (always 1 today). */
  bucketSeconds: number;
}
