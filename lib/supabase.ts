// Supabase admin client - 仅服务端使用
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let _admin: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (_admin) return _admin;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url) throw new Error('缺少 NEXT_PUBLIC_SUPABASE_URL 环境变量');
  if (!key) throw new Error('缺少 SUPABASE_SECRET_KEY 环境变量');
  _admin = createClient(url, key, { auth: { persistSession: false } });
  return _admin;
}

export const BUCKET = process.env.SUPABASE_BUCKET || 'uploads';
