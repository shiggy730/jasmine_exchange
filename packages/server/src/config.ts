import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const BOT_SPREAD: Record<string, number> = {
  // Original 8
  JSM: 0.02,
  SFR: 0.04,
  VNL: 0.03,
  LTS: 0.025,
  LVD: 0.015,
  GNG: 0.035,
  ORC: 0.04,
  TRM: 0.01,
  // New 12 — spread scales with price (cheaper/larger-supply = tighter)
  MRG: 0.008,
  HBS: 0.015,
  AZL: 0.02,
  GDN: 0.02,
  ROS: 0.025,
  SAT: 0.03,
  CHR: 0.025,
  CAM: 0.03,
  WST: 0.035,
  DHL: 0.03,
  MGL: 0.035,
  PNY: 0.04,
};

export const config = {
  port: parseInt(process.env['PORT'] ?? '3000', 10),
  priceHistoryCap: parseInt(process.env['PRICE_HISTORY_CAP'] ?? '100', 10),
  startingGold: 500,
  dbPath: process.env['DB_PATH'] ?? path.join(__dirname, '..', 'jasmine.db'),
  /** Trades and per-trade price_history ticks older than this are pruned daily. Daily close snapshots are kept forever. */
  dataRetentionMs: 14 * 24 * 60 * 60 * 1000,
} as const;
