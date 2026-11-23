import argon2 from 'argon2';
import { validatePassword } from './validation.js';

export async function hashPassword(value) {
  validatePassword(value);
  return argon2.hash(value, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });
}
export async function verifyPassword(hash, value) {
  if (typeof hash !== 'string' || !hash.startsWith('$argon2id$') || typeof value !== 'string') return false;
  try { return await argon2.verify(hash, value); } catch { return false; }
}
