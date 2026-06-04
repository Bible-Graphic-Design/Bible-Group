// GET /api/assets — 返回历史上传的参考图（最近 50 张）
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get('limit') || 50), 200);
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from('assets')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ assets: data || [] });
}
