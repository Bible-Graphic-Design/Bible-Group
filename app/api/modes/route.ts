// GET /api/modes — 返回内置改版方向定义（前端用来渲染 chip 和定制浮层）
import { NextResponse } from 'next/server';
import { BUILTIN_MODES, FONT_FAMILIES, FONT_WEIGHTS, FONT_CASES } from '@/lib/modes';

export const runtime = 'nodejs';
export const dynamic = 'force-static';

export async function GET() {
  return NextResponse.json({
    modes: BUILTIN_MODES.map(m => ({
      id: m.id,
      name: m.name,
      desc: m.desc,
      prompt: m.prompt,
      styles: m.styles,
      fixedModel: m.fixedModel || null,
    })),
    fonts: { families: FONT_FAMILIES, weights: FONT_WEIGHTS, cases: FONT_CASES },
  });
}
