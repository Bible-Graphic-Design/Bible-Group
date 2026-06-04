// POST /api/tasks — 创建一组变体任务,挨个调 jarvis 生成,结果存进数据库
// GET  /api/tasks — 查询任务列表（按 zone_id 或 全部）
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { now, uid, LETTERS } from '@/lib/utils';
import { generate } from '@/lib/jarvis';
import { getMode } from '@/lib/modes';
import type { ModeId, ModelId, Quality, Ratio } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 单次最多 5 分钟,生成图片偶尔较慢

/* GET — 列出任务（支持按 zone_id 过滤） */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const zoneId = searchParams.get('zone_id');
  const limit = Math.min(Number(searchParams.get('limit') || 200), 500);

  const sb = getSupabaseAdmin();
  let q = sb.from('tasks').select('*').order('created_at', { ascending: false }).limit(limit);
  if (zoneId) q = q.eq('zone_id', zoneId);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tasks: data || [] });
}

/* POST — 创建一组变体任务 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      zone_id,
      asset_id,
      model,
      ratio,
      quality,
      mode_id,
      extra_prompt,
      styles = [],
      font = {},
      market,
      count = 3,
    } = body || {};

    if (!zone_id) return NextResponse.json({ error: '缺少 zone_id' }, { status: 400 });
    if (!asset_id) return NextResponse.json({ error: '缺少 asset_id' }, { status: 400 });
    if (!mode_id) return NextResponse.json({ error: '缺少 mode_id' }, { status: 400 });
    if (!ratio || !quality) return NextResponse.json({ error: '缺少 ratio/quality' }, { status: 400 });

    const modeDef = getMode(mode_id);
    if (!modeDef) return NextResponse.json({ error: `未知方向: ${mode_id}` }, { status: 400 });

    const sb = getSupabaseAdmin();

    // 取参考图 URL
    const { data: assetRow, error: aErr } = await sb.from('assets').select('*').eq('id', asset_id).single();
    if (aErr || !assetRow) return NextResponse.json({ error: '参考图不存在' }, { status: 404 });

    // 同 zone 已有变体数（决定字母编号起点）
    const { count: existingCount } = await sb
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('zone_id', zone_id);
    const startIdx = existingCount || 0;

    const safeCount = Math.max(1, Math.min(10, Number(count)));
    const taskRows: any[] = [];

    // 1. 先把所有变体以 pending 状态插入数据库
    for (let i = 0; i < safeCount; i++) {
      const tid = uid('t');
      taskRows.push({
        id: tid,
        zone_id,
        asset_id,
        model: model || 'gemini-3-pro-image-preview',
        ratio,
        quality,
        mode_id,
        extra_prompt: extra_prompt || null,
        styles,
        font,
        letter: LETTERS[(startIdx + i) % 26],
        seed: startIdx + i,
        status: 'pending',
        error_message: null,
        output_url: null,
        winner: false,
        created_at: now(),
        updated_at: now(),
      });
    }
    await sb.from('tasks').insert(taskRows);

    // 2. 并发调 jarvis(Promise.all),每个完成后更新自己那行
    const promises = taskRows.map(async (row) => {
      try {
        await sb.from('tasks').update({ status: 'running', updated_at: now() }).eq('id', row.id);
        const out = await generate({
          modeDef,
          modeId: mode_id as ModeId,
          userModel: model as ModelId,
          ratio: ratio as Ratio,
          quality: quality as Quality,
          market,
          extraPrompt: extra_prompt,
          styles,
          font,
          referenceUrl: assetRow.url,
        });
        await sb.from('tasks').update({
          status: 'succeeded',
          output_url: out.imageUrl || null,
          // 文本类返回存到 error_message 字段做临时载体（有更好方案后续重构）
          error_message: out.text || null,
          model: out.model,
          updated_at: now(),
        }).eq('id', row.id);
      } catch (e: any) {
        await sb.from('tasks').update({
          status: 'failed',
          error_message: e?.message || String(e),
          updated_at: now(),
        }).eq('id', row.id);
      }
    });

    // 不等所有完成 — 让前端轮询拿结果（避免 Vercel 函数超时）
    // 但至少等一秒让前几个开始,体验更好
    await Promise.race([
      Promise.all(promises),
      new Promise(r => setTimeout(r, 1000)),
    ]);

    // 返回任务 ID 列表给前端,前端轮询查询
    return NextResponse.json({
      task_ids: taskRows.map(r => r.id),
      zone_id,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || '创建任务失败' }, { status: 500 });
  }
}
