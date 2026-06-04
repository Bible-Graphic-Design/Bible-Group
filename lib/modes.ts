// 7 条内置改版方向 + 全局规则 + 模型分配

import type { ModeId, ModelId } from './types';

export interface ModeDef {
  id: ModeId;
  name: string;
  desc: string;
  prompt: string;
  styles: string[];
  /** 是否锁定模型 — 去水印走 seedream-4 不可改 */
  fixedModel?: ModelId;
}

/**
 * 全局规则 A-G — 任何方向生成时都会前置注入到 Prompt
 * 依据团队 Q&A：8 条改版方向 + 中英对照 prompt 规范确认稿
 */
export const GLOBAL_RULES = `GLOBAL QUALITY RULES (apply to every generation, never violate):
A. SINGLE INDEPENDENT IMAGE: Each generation outputs ONE complete, standalone composition. Never produce a collage, grid, 2x2 panel, 4-up layout, side-by-side comparison.
B. NO SCENE BUGS: The scene must be physically and logically coherent. No floating objects, mismatched shadows, broken perspective, AI artifacts.
C. AESTHETIC COLOR: Use a harmonious, intentional color palette. Avoid muddy, oversaturated, neon-clashing combinations. Aim for refined ad-quality color.
D. CRISP DETAILS: Backgrounds and props must have clean, believable detail.
E. NO GARBLED CHARACTERS: Any letters/characters on canvas must be real, correctly spelled words. Zero tolerance for fake-letter shapes or AI-hallucinated symbols.
F. AD-READY OUTPUT: Final image must look professional, polished, and brand-safe.
G. ADAPTIVE TEXT COLOR — MANDATORY CONTRAST CHECK: After replacing the background, you MUST re-evaluate every text block against the new background. If contrast ratio < 4.5:1 (WCAG AA), you MUST change the text fill color so the text stays clearly readable. Light/pastel bg → dark text; dark bg → light text. Preserve "visual highlight role" of accent words. Text content/wording/font/size/position remain locked. ONLY fill color may change.`;

export const BUILTIN_MODES: ModeDef[] = [
  {
    id: 'bg-similar',
    name: '换背景 1',
    desc: '同风格 · 不同样式',
    prompt: `[GLOBAL QUALITY RULES — apply A-G]
TASK: Replace ONLY the background with a NEW scene that keeps the EXACT SAME visual style, palette, lighting, and emotional tone as the reference, but with a different layout / composition.
RULES:
1. ALL on-image text preserved verbatim — words, letters, fonts, sizes, positions. (Per Rule G, only text fill color may adapt.)
2. STRONG contrast (WCAG AA+) under every text block. Apply Rule G's mandatory color check.
3. Preserve original text hierarchy: headline > body > CTA.
4. Keep main subject and key elements untouched.`,
    styles: ['日系晨光', '韩系马卡龙', '极简白底', '暖色家居', '自然光感', '森系绿植', '咖啡日常', '卧室静物'],
  },
  {
    id: 'bg-diff',
    name: '换背景 2',
    desc: '差异大 · 不同风格不同样式',
    prompt: `[GLOBAL QUALITY RULES — apply A-G]
TASK: Replace ONLY the background with a COMPLETELY DIFFERENT scene that uses a contrasting visual style, palette, and mood. Maximize visual surprise.
RULES:
1. ALL on-image text preserved verbatim. (Per Rule G, only text fill color may shift.)
2. STRONG contrast under every text block. Apply Rule G's mandatory color check. Dark bg → white/cream text; light bg → deep navy/charcoal.
3. Preserve original text hierarchy.
4. Keep main subject identifiable.`,
    styles: ['星空夜景', '戏剧光影', '港味霓虹', '复古胶片', '油画质感', '赛博朋克', '极地冰川', '沙漠日落'],
  },
  {
    id: 'restyle',
    name: '换风格',
    desc: '不同风格 · 同样式',
    prompt: `[GLOBAL QUALITY RULES — apply A-G]
TASK: Restyle the reference into a different artistic / visual style while KEEPING the same composition, background layout, subject placement.
RULES:
1. ALL on-image text preserved verbatim. Text strokes must remain crisp.
2. STRONG contrast under every text block.
3. Layout, crop, and text positions stay identical.
4. Main subject identifiable.`,
    styles: ['3D 渲染', '日系动漫', '水彩手绘', '复古胶片', '极简扁平', '吉卜力', '黏土风', '油画质感'],
  },
  {
    id: 'inpaint',
    name: '局部重绘',
    desc: '指定区域换内容',
    prompt: `[GLOBAL QUALITY RULES — apply A-G]
TASK: Inpaint a specific region described in the user instruction. Leave everything OUTSIDE that region pixel-stable.
RULES:
1. Unchanged region must remain pixel-stable.
2. New content blends seamlessly — matching lighting, shadow, color temperature, perspective.
3. ALL on-image text outside the edited region preserved verbatim.
4. STRONG contrast for any text near the edited region after the edit.`,
    styles: ['无缝融合', '匹配光线', '匹配色温', '保留材质', '保留景深'],
  },
  {
    id: 'remove-wm',
    name: '去水印',
    desc: '竞品研究 / 二创',
    fixedModel: 'bytedance/seedream-4',
    prompt: `[GLOBAL QUALITY RULES — apply A-G]
TASK: Detect and remove ALL watermarks, brand logos, app icons, and overlaid attribution marks. Reconstruct pixels naturally based on surrounding content.
RULES:
1. ALL on-image copy (headlines, body, CTA, scripture quotes) preserved verbatim. NEVER confuse copy with watermark.
2. STRONG contrast for every text block after cleanup. Reconstruction must not blur or distort surrounding text.
3. Background under removed marks must look natural — no smearing, no ghost outlines, no clone seams.`,
    styles: ['彻底清除', '保留底层细节', '克隆周边纹理'],
  },
  {
    id: 'rewrite-copy',
    name: '改文案',
    desc: '标题 · 内容 · 按钮',
    prompt: `[GLOBAL QUALITY RULES — apply A-G]
TASK: Rewrite the on-image copy — headline, supporting body, and CTA button — while keeping the visual design (background, decorations, layout, fonts, colors, sizes, positions) completely unchanged.
RULES:
1. ONLY the words change. Visual design stays identical.
2. Keep same text hierarchy: strong headline + short supporting line + high-conversion CTA.
3. Match line length to original text boxes — do not overflow.
4. Spelling 100% correct in {{market}}.
5. STRONG contrast preserved.
6. New copy relevant to Bible growth / faith / daily devotion. Emotionally warm. For women in {{market}}.
7. One variant per generation.

LANGUAGE: {{market}}.`,
    styles: ['情感共鸣', '行动召唤', '数字利益', '悬念好奇', '日常陪伴', '应许鼓励', '故事化', '直白清晰'],
  },
  {
    id: 'i18n',
    name: '多语言本地化',
    desc: 'EN · ES · PT · FR',
    prompt: `[GLOBAL QUALITY RULES — apply A-G]
TASK: Translate ALL on-image text into {{market}} while keeping the visual design completely unchanged. Preserve original meaning, tone, and emotional impact.
RULES:
1. ONLY the words change to {{market}}. Visual design stays identical.
2. Adjust line breaks if destination language is longer (ES/PT often expand 20-30% from EN). Keep all text in original boxes.
3. Spelling, accents, special characters 100% correct (ñ á é í ó ú ü ç à â ô).
4. Preserve original hierarchy.
5. Translation must feel native to {{market}}. Avoid stiff machine-literal phrasing.`,
    styles: ['母语自然', '口语化', '正式书面', '保留经文引用', '简短紧凑'],
  },
];

export const FONT_FAMILIES = [
  { id: 'sans', label: '无衬线 Sans' },
  { id: 'serif', label: '衬线 Serif' },
  { id: 'script', label: '手写体 Script' },
  { id: 'display', label: '装饰体 Display' },
  { id: 'condensed', label: '紧凑体 Condensed' },
  { id: 'mono', label: '等宽 Mono' },
] as const;

export const FONT_WEIGHTS = [
  { id: 'light', label: '细 Light' },
  { id: 'regular', label: '常规 Regular' },
  { id: 'medium', label: '中 Medium' },
  { id: 'semibold', label: '半粗 SemiBold' },
  { id: 'bold', label: '粗 Bold' },
  { id: 'extrabold', label: '超粗 ExtraBold' },
] as const;

export const FONT_CASES = [
  { id: 'as-is', label: '保持原样' },
  { id: 'upper', label: '全大写 ABCD' },
  { id: 'title', label: '词首大写 Abcd' },
  { id: 'lower', label: '全小写 abcd' },
] as const;

export function getMode(id: string): ModeDef | undefined {
  return BUILTIN_MODES.find(m => m.id === id);
}

/**
 * 决定一个变体最终用哪个模型：
 * - 去水印：固定 bytedance/seedream-4
 * - 其他：尊重用户的选择，默认 gemini-3-pro-image-preview
 */
export function resolveModel(modeId: string, userModel?: ModelId): ModelId {
  const mode = getMode(modeId);
  if (mode?.fixedModel) return mode.fixedModel;
  return userModel || 'gemini-3-pro-image-preview';
}
