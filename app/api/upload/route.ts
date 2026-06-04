// POST /api/upload — 上传参考图到 Supabase Storage,返回 asset 记录
import { NextRequest, NextResponse } from 'next/server';
import path from 'node:path';
import { getSupabaseAdmin, BUCKET } from '@/lib/supabase';
import { now, uid, safeFilename } from '@/lib/utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 50 * 1024 * 1024; // 50MB,Vercel Edge 限制比这小,真大文件上线后再调

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const files = form.getAll('files') as File[];
    if (!files.length) return NextResponse.json({ error: '未收到文件' }, { status: 400 });

    const sb = getSupabaseAdmin();
    const saved: any[] = [];

    for (const f of files) {
      if (!ALLOWED.includes(f.type)) {
        return NextResponse.json({ error: `不支持的格式: ${f.type}` }, { status: 400 });
      }
      if (f.size > MAX_SIZE) {
        return NextResponse.json({ error: `文件 ${f.name} 超过 50MB` }, { status: 400 });
      }

      const ext = path.extname(f.name) || '.png';
      const id = uid('a');
      const objectKey = `${new Date().toISOString().slice(0, 10)}/${id}_${safeFilename(path.basename(f.name, ext))}${ext}`;
      const buf = Buffer.from(await f.arrayBuffer());

      const { error: upErr } = await sb.storage.from(BUCKET).upload(objectKey, buf, {
        contentType: f.type,
        upsert: false,
      });
      if (upErr) return NextResponse.json({ error: `上传到 Storage 失败: ${upErr.message}` }, { status: 500 });

      const { data: pub } = sb.storage.from(BUCKET).getPublicUrl(objectKey);
      const url = pub.publicUrl;

      const row = {
        id,
        filename: objectKey,
        original_name: f.name,
        mime: f.type,
        size: f.size,
        url,
        created_at: now(),
      };

      const { error: insErr } = await sb.from('assets').insert(row);
      if (insErr) return NextResponse.json({ error: `写入数据库失败: ${insErr.message}` }, { status: 500 });

      saved.push(row);
    }

    return NextResponse.json({ assets: saved });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || '上传失败' }, { status: 500 });
  }
}
