// jarvis 网关适配层
// gemini 走 /v1/chat/completions + multimodal(图进图出)
// gpt-image-2 / seedream-4 走 /v1/images/edits
// claude 走 /v1/chat/completions

import type { ModeId, ModelId, Quality, Ratio } from './types';
import { resolveModel, type ModeDef } from './modes';
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
  market?: string;
  extraPrompt?: string;
  styles?: string[];
  font?: { family?: string; weight?: string; case?: string; custom?: string };
  referenceUrl: string;
}

export interface GenerateOutput {
  imageUrl?: string;
  text?: string;
  model: ModelId;
  raw?: any;
}

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

export async function generate(input: GenerateInput): Promise<GenerateOutput> {
  const model = resolveModel(input.modeId, input.userModel);
  const prompt = buildPrompt(input);

  if (model.startsWith('gemini-') || model.startsWith('claude-')) {
    return await callChat(model, prompt, input);
  }
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
  const message = json?.choices?.[0]?.message;
  const text: string = message?.content || '';

  const imageUrl =
    message?.image_url ||
    json?.images?.[0]?.url ||
    json?.data?.[0]?.url ||
    extractImageFromText(text);

  if (imageUrl) {
    return { model, imageUrl, text: text || undefined, raw: json };
  }
  return { model, text, raw: json };
}

function extractImageFromText(text: string): string | undefined {
  if (!text) return undefined;
  const dataMatch = text.match(/data:image\/[a-zA-Z]+;base64,[A-Za-z0-9+/=]+/);
  if (dataMatch) return dataMatch[0];
  const mdMatch = text.match(/!\[[^\]]*\]\((https?:\/\/[^\s)]+)\)/);
  if (mdMatch) return mdMatch[1];
  const urlMatch = text.match(/https?:\/\/\S+\.(?:png|jpg|jpeg|webp|svg)/i);
  if (urlMatch) return urlMatch[0];
  return undefined;
}

async function callImage(
  model: ModelId,
  prompt: string,
  input: GenerateInput
): Promise<GenerateOutput> {
  const [w, h] = RATIO_PX[input.ratio];
  const scale = QUALITY_SCALE[input.quality];
  const size = `${w * scale}x${h * scale}`;

  const url = `${BASE_URL}/v1/images/edits`;
  const body: any = {
    model,
    prompt,
    n: 1,
    size,
    image: input.referenceUrl,
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
    (json?.data?.[0]?.b64_json && `data:image/png;base64,${json.data[0].b64_json}`) ||
    json?.images?.[0]?.url ||
    json?.url;
  if (!imageUrl) {
    throw new Error(`jarvis image 返回未找到图片 URL,原始: ${JSON.stringify(json).slice(0, 300)}`);
  }
  return { model, imageUrl, raw: json };
}
