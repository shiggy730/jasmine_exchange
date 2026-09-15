import type { Player } from './player.js';

export interface AuthResult {
  player: Player;
  token: string;
}
