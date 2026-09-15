import type Database from 'better-sqlite3';

export interface Migration {
  /** Sequential, gapless, starting at 1. Never reuse or reorder a version once committed. */
  version: number;
  /** Short kebab-case description, e.g. 'add-player-avatar-color'. */
  name: string;
  /** Mutates the schema and/or backfills data. Runs inside a transaction — throw to abort and roll back. */
  up: (db: Database.Database) => void;
}
