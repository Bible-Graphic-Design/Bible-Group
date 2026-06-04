// 公用工具
import crypto from 'node:crypto';

export function uid(prefix = ''): string {
  const id = crypto.randomBytes(8).toString('hex');
  return prefix ? `${prefix}_${id}` : id;
}

export function now(): number {
  return Date.now();
}

export function safeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9_.\-一-龥]/g, '_').slice(0, 80);
}

export const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
