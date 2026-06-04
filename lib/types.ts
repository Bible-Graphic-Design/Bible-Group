// 数据模型类型

export type ModeId =
  | 'bg-similar'      // 换背景 1
  | 'bg-diff'         // 换背景 2
  | 'restyle'         // 换风格
  | 'inpaint'         // 局部重绘
  | 'remove-wm'       // 去水印
  | 'rewrite-copy'    // 改文案
  | 'i18n';           // 多语言

export type ModelId =
  | 'gemini-3-pro-image-preview'
  | 'openai/gpt-image-2'
  | 'bytedance/seedream-4'
  | 'claude-sonnet-4-6';

export type Ratio = '1:1' | '3:4' | '4:3' | '2:3' | '3:2' | '4:5' | '5:4' | '9:16' | '16:9';
export type Quality = '1K' | '2K' | '4K';
export type TaskStatus = 'pending' | 'running' | 'succeeded' | 'failed';

export interface AssetRow {
  id: string;
  filename: string;
  original_name: string;
  mime: string;
  size: number;
  url: string;
  created_at: number;
}

export interface TaskRow {
  id: string;
  zone_id: string;
  asset_id: string;
  model: ModelId;
  ratio: Ratio;
  quality: Quality;
  mode_id: ModeId;
  extra_prompt: string | null;
  styles: string[];
  font: { family?: string; weight?: string; case?: string; custom?: string };
  letter: string | null;
  seed: number | null;
  status: TaskStatus;
  error_message: string | null;
  output_url: string | null;
  winner: boolean;
  created_at: number;
  updated_at: number;
}

export const RATIO_PX: Record<Ratio, [number, number]> = {
  '1:1': [1024, 1024],
  '3:4': [960, 1280],
  '4:3': [1280, 960],
  '2:3': [864, 1296],
  '3:2': [1296, 864],
  '4:5': [1024, 1280],
  '5:4': [1280, 1024],
  '9:16': [720, 1280],
  '16:9': [1280, 720],
};

export const QUALITY_SCALE: Record<Quality, number> = {
  '1K': 1, '2K': 2, '4K': 4,
};
