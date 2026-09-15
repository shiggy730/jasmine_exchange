import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';

const KEY_LENGTH = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, KEY_LENGTH);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

export function verifyPassword(password: string, stored: string | null): boolean {
  if (!stored) return false;
  const sepIndex = stored.indexOf(':');
  if (sepIndex === -1) return false;

  const salt = Buffer.from(stored.slice(0, sepIndex), 'hex');
  const storedHash = Buffer.from(stored.slice(sepIndex + 1), 'hex');
  const computedHash = scryptSync(password, salt, KEY_LENGTH);

  if (computedHash.length !== storedHash.length) return false;
  return timingSafeEqual(computedHash, storedHash);
}

export function generateToken(): string {
  return randomBytes(32).toString('hex');
}
