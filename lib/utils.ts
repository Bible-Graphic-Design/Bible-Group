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
  // Supabase Storage 的 object key 只能用 ASCII,中文/空格/特殊字符全部替换为下划线
  const cleaned = name.replace(/[^a-zA-Z0-9_.\-]/g, '_').replace(/_+/g, '_').slice(0, 60);
  // 如果整个 cleaned 都是下划线（比如原文件名全是中文），fallback 一个默认名
  return cleaned.replace(/^_+|_+$/g, '') || 'image';
}

export const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
