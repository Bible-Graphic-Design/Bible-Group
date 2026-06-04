// PATCH /api/tasks/[id] — 更新单个变体（标 winner / 重生成 等）
// DELETE /api/tasks/[id] — 删除单个变体
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { now } from '@/lib/utils';
import { generate } from '@/lib/jarvis';
import { getMode } from '@/lib/modes';
import type { ModeId, ModelId, Quality, Ratio } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = params.id;
    const body = await req.json();
    const sb = getSupabaseAdmin();

    // 操作类型
    if (body.action === 'pick') {
      // 标记 / 取消标记 winner
      const { data: cur } = await sb.from('tasks').select('winner').eq('id', id).single();
      const newWinner = !(cur?.winner);
      await sb.from('tasks').update({ winner: newWinner, updated_at: now() }).eq('id', id);
      return NextResponse.json({ ok: true, winner: newWinner });
    }

    if (body.action === 'regen') {
      // 重新生成
      const { data: row, error } = await sb.from('tasks').select('*').eq('id', id).single();
      if (error || !row) return NextResponse.json({ error: '任务不存在' }, { status: 404 });

      const { data: asset } = await sb.from('assets').select('*').eq('id', row.asset_id).single();
      if (!asset) return NextResponse.json({ error: '参考图不存在' }, { status: 404 });

      const modeDef = getMode(row.mode_id);
      if (!modeDef) return NextResponse.json({ error: '方向不存在' }, { status: 400 });

      await sb.from('tasks').update({
        status: 'running',
        output_url: null,
        error_message: null,
        updated_at: now(),
      }).eq('id', id);

      try {
        const out = await generate({
          modeDef,
          modeId: row.mode_id as ModeId,
          userModel: row.model as ModelId,
          ratio: row.ratio as Ratio,
          quality: row.quality as Quality,
          market: body.market,
          extraPrompt: row.extra_prompt,
          styles: row.styles || [],
          font: row.font || {},
          referenceUrl: asset.url,
        });
        await sb.from('tasks').update({
          status: 'succeeded',
          output_url: out.imageUrl || null,
          error_message: out.text || null,
          model: out.model,
          updated_at: now(),
        }).eq('id', id);
        return NextResponse.json({ ok: true });
      } catch (e: any) {
        await sb.from('tasks').update({
          status: 'failed',
          error_message: e?.message || String(e),
          updated_at: now(),
        }).eq('id', id);
        return NextResponse.json({ error: e?.message }, { status: 500 });
      }
    }

    return NextResponse.json({ error: '未知 action' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || '操作失败' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const sb = getSupabaseAdmin();
  const { error } = await sb.from('tasks').delete().eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
