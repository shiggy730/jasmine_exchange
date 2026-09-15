import type Database from 'better-sqlite3';
import { generateToken } from '../domain/auth.js';

export class SessionRepository {
  constructor(private readonly db: Database.Database) {}

  create(playerId: string): string {
    const token = generateToken();
    this.db
      .prepare('INSERT INTO sessions (token, player_id, created_at) VALUES (?, ?, ?)')
      .run(token, playerId, Date.now());
    return token;
  }

  getPlayerId(token: string): string | null {
    const row = this.db.prepare('SELECT player_id FROM sessions WHERE token = ?').get(token) as
      | { player_id: string }
      | undefined;
    return row?.player_id ?? null;
  }

  /** Invalidate every session for a player — used on admin password reset and before a hard delete. */
  deleteAllForPlayer(playerId: string): void {
    this.db.prepare('DELETE FROM sessions WHERE player_id = ?').run(playerId);
  }
}
