// jarvis 网关适配层
// 假设：OpenAI 兼容协议 (Bearer Token + /v1/...)
// 真实接入后如果协议不同,只需改本文件

import type { ModeDef, ModeId, ModelId, Quality, Ratio } from './types';
import { resolveModel } from './modes';
import { RATIO_PX, QUALITY_SCALE } from './types';

const BASE_URL = process.env.JARVIS_BASE_URL || 'https://gateway.ddit.ai';

function getKey(): string {
  const key = process.env.JARVIS_API_KEY;
  if (!key) throw new Error('缺少 JARVIS_API_KEY 环境变量');
  return key;
}

function authHeaders() {
  return {
    'Authorization': `Bearer ${getKey()}`,
    'Content-Type': 'application/json',
  };
}

export interface GenerateInput {
  modeDef: ModeDef;
  modeId: ModeId;
  userModel?: ModelId;
  ratio: Ratio;
  quality: Quality;
  market?: string;        // EN / ES / PT / FR
  extraPrompt?: string;
  styles?: string[];
  font?: { family?: string; weight?: string; case?: string; custom?: string };
  /** 参考图 URL (Supabase Storage public URL) */
  referenceUrl: string;
}

export interface GenerateOutput {
  /** 生成的图片 URL（来自 jarvis 返回，前端会直接用） */
  imageUrl?: string;
  /** 文本类返回（改文案/翻译可能直接给文本，需要前端二次处理） */
  text?: string;
  /** 实际使用的模型 ID */
  model: ModelId;
  /** 用于调试的原始响应 */
  raw?: any;
}

/**
 * 组合最终发给模型的 prompt
 */
export function buildPrompt(input: GenerateInput): string {
  const parts: string[] = [];
  parts.push(input.modeDef.prompt);

  if (input.market) {
    parts[0] = parts[0].replace(/\{\{market\}\}/g, input.market);
  }

  if (input.styles && input.styles.length) {
    parts.push(`\nSTYLE PRESETS (apply all): ${input.styles.join(' / ')}`);
  }

  if (input.font && (input.font.family || input.font.custom || input.font.weight || (input.font.case && input.font.case !== 'as-is'))) {
    const fontDesc: string[] = [];
    if (input.font.custom) fontDesc.push(`font name: "${input.font.custom}"`);
    else if (input.font.family) fontDesc.push(`font family: ${input.font.family}`);
    if (input.font.weight) fontDesc.push(`weight: ${input.font.weight}`);
    if (input.font.case && input.font.case !== 'as-is') fontDesc.push(`case: ${input.font.case}`);
    parts.push(`\nFONT CUSTOMIZATION: ${fontDesc.join(', ')}`);
  }

  if (input.extraPrompt && input.extraPrompt.trim()) {
    parts.push(`\nADDITIONAL INSTRUCTION: ${input.extraPrompt.trim()}`);
  }

  return parts.join('\n');
}

/**
 * 主入口 — 调用 jarvis 生成
 */
export async function generate(input: GenerateInput): Promise<GenerateOutput> {
  const model = resolveModel(input.modeId, input.userModel);
  const prompt = buildPrompt(input);

  // 文本类方向 走 chat completions（claude）
  if (input.modeId === 'rewrite-copy' || input.modeId === 'i18n') {
    return await callChat(model, prompt, input);
  }

  // 图像类方向 走 image generation
  return await callImage(model, prompt, input);
}

async function callChat(
  model: ModelId,
  prompt: string,
  input: GenerateInput
): Promise<GenerateOutput> {
  const url = `${BASE_URL}/v1/chat/completions`;
  const body = {
    model,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: input.referenceUrl } },
        ],
      },
    ],
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`jarvis chat ${res.status}: ${errText}`);
  }
  const json: any = await res.json();
  const text = json?.choices?.[0]?.message?.content || '';
  return { model, text, raw: json };
}

async function callImage(
  model: ModelId,
  prompt: string,
  input: GenerateInput
): Promise<GenerateOutput> {
  const [w, h] = RATIO_PX[input.ratio];
  const scale = QUALITY_SCALE[input.quality];
  const size = `${w * scale}x${h * scale}`;

  // 走 OpenAI 兼容的 images/edits（因为有参考图）
  // 不同的网关可能用不同字段名 — 真接入时根据返回报错调整
  const url = `${BASE_URL}/v1/images/generations`;
  const body: any = {
    model,
    prompt,
    n: 1,
    size,
    image: input.referenceUrl, // 部分网关用 image_url
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`jarvis image ${res.status}: ${errText}`);
  }
  const json: any = await res.json();
  const imageUrl =
    json?.data?.[0]?.url ||
    json?.data?.[0]?.image_url ||
    json?.images?.[0]?.url ||
    json?.url;
  if (!imageUrl) {
    throw new Error(`jarvis 返回未找到图片 URL,原始: ${JSON.stringify(json).slice(0, 200)}`);
  }
  return { model, imageUrl, raw: json };
}
