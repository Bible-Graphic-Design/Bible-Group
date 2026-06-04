# BIBLE GROUP

> Bible Group 信息流素材改版工具的 Next.js 生产版。
> 接入 Supabase（数据 / 文件存储） + jarvis AI 网关（gemini-3-pro / gpt-image-2 / seedream-4 / claude）。

---

## 第一次部署：从代码到上线（约 15 分钟）

### 前置检查清单

下面这些**必须已经准备好**：

- [x] Supabase 公司账号项目 `bible-group-prod`
- [x] Supabase `Project URL` 已存到本地记事本
- [x] Supabase `Secret Key` (`sb_secret_...`) 已存到本地记事本
- [x] Supabase Storage 里已建好 `uploads` 桶（Public）
- [x] jarvis API Key (`sk-...`) 已存到本地记事本
- [x] jarvis 网关 base URL: `https://gateway.ddit.ai`
- [x] GitHub 公司账号已登录
- [x] Vercel 公司账号已登录

---

### Step 1：在 Supabase 跑建表 SQL

1. 进 Supabase 项目 → **SQL Editor**
2. 新建查询 → 把 `supabase/schema.sql` 整个文件内容粘贴进去
3. 点 **Run**
4. 看到 "Success. No rows returned" = ✅

> 你之前可能已经跑过类似的 SQL — 重复跑也没关系，里面用了 `if not exists`。

---

### Step 2：在 GitHub 建新仓库

1. 公司账号下 → **+** → **New repository**
2. **Repository name**：`bible-group`
3. 选 **Public**（Vercel 免费档要 Public）
4. 勾选 **Add a README file**
5. 点 **Create repository**

---

### Step 3：把这个项目代码上传到仓库

最简单的方式：**网页上传**

1. 把 zip 文件解压到电脑某个位置（比如桌面 `bible-group/`）
2. 进 GitHub 你刚建的仓库主页
3. 点 **Add file → Upload files**
4. **选中解压后整个文件夹里的所有内容**（不要选最外层文件夹，要进去选里面）
5. 拖到上传区
6. 滚到底部 → 写 commit message: `init bible-group nextjs project`
7. 点 **Commit changes**

> 或者用 git 命令：
> ```bash
> cd bible-group/
> git init && git add . && git commit -m "init"
> git branch -M main
> git remote add origin https://github.com/你的用户名/bible-group.git
> git push -u origin main
> ```

---

### Step 4：在 Vercel 导入这个仓库

1. 打开 https://vercel.com/dashboard
2. 点 **Add New → Project**
3. 找到 `bible-group` 仓库 → 点 **Import**
4. 第一次会让你给 Vercel 装 GitHub 应用 → 选 `bible-group` 仓库授权
5. 进入项目配置页：
   - **Framework Preset**：Vercel 应该自动识别为 **Next.js**（如果没有就手动选 Next.js）
   - **Root Directory**：保持 `./`
   - 其他保持默认

---

### Step 5：填环境变量（最重要的一步）

**先别点 Deploy** — 在配置页找到 **Environment Variables** 折叠区域，展开后逐个添加：

| Key | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | 你 Supabase 的 Project URL（`https://xxxxxx.supabase.co`） |
| `SUPABASE_SECRET_KEY` | 你 Supabase 的 secret key（`sb_secret_...`） |
| `SUPABASE_BUCKET` | `uploads` |
| `JARVIS_BASE_URL` | `https://gateway.ddit.ai` |
| `JARVIS_API_KEY` | 你的 jarvis API Key（`sk-...`） |

每填一组都点 **Add**。

⚠️ 这些 Key 只填到 Vercel 环境变量里，**不要写进代码**、**不要传到 GitHub**。

---

### Step 6：点 Deploy

填完环境变量后，最下方点 **Deploy**。

等 1–3 分钟，Vercel 会：
1. 拉代码
2. 跑 `npm install`
3. 跑 `npm run build`
4. 部署上线

构建完成 → 拿到网址 `https://bible-group-xxxx.vercel.app`

发给团队就能用。

---

## 验证部署成功

打开网址后试：

1. 点右上角 **+ 上传参考图**，传一张图
2. 应该看到一个新的"任务分区"卡片出现
3. 选个比例 / 大小
4. 点左侧"生成 N 张 · 换背景 1"按钮
5. 几秒后应该看到变体卡片填充真实生成的图

如果出错，看下面"调试"。

---

## 调试：哪里出错了怎么看

### 问题 1：上传图失败

- Vercel 后台 → 项目 → **Logs** 看实时日志
- 常见原因：Supabase 凭证错、Storage 桶不是 Public、桶名不叫 `uploads`

### 问题 2：生成失败（变体卡显示"失败"）

- 鼠标悬停"失败"标签，能看到 `error_message`
- 常见原因：
  - **jarvis 网关协议跟假设不一致** — `lib/jarvis.ts` 里的请求字段名要改（比如 `image` 改成 `image_url`、或 `prompt` 改成 `text` 等）
  - **模型 ID 拼错** — jarvis 模型列表里复制完整 ID 改进 `lib/modes.ts`
  - **Key 错或额度耗尽**

### 问题 3：生成成功但图片不显示

- 检查 jarvis 返回的 image URL 字段在 `lib/jarvis.ts` 第 156 行附近
- 不同网关返回字段名不同，调整 `imageUrl = json?.data?.[0]?.url || ...` 这行

---

## 改 prompt / 改模型分配

- 7 条改版方向的 prompt 都在 `lib/modes.ts` 里
- 模型分配规则在 `resolveModel()` 函数：去水印固定 seedream-4，其他默认 gemini-3-pro
- 改完 → push GitHub → Vercel 自动重新部署 → 30 秒生效

---

## 改前端 UI

- 整个前端就一个文件：`app/page.tsx`（约 500 行）
- 样式在 `app/globals.css`
- 改完 push 即生效

---

## 项目结构

```
bible-group/
├── app/
│   ├── api/
│   │   ├── upload/route.ts           上传参考图到 Supabase Storage
│   │   ├── tasks/route.ts            创建/查询变体任务（核心）
│   │   ├── tasks/[id]/route.ts       重生成 / 标 winner / 删除
│   │   ├── modes/route.ts            返回内置改版方向
│   │   └── assets/route.ts           查询历史参考图
│   ├── layout.tsx
│   ├── page.tsx                      前端核心 UI
│   └── globals.css
├── lib/
│   ├── supabase.ts                   Supabase 客户端
│   ├── jarvis.ts                     jarvis 适配层（关键文件）
│   ├── modes.ts                      7 条方向 + prompt + 模型路由
│   ├── types.ts
│   └── utils.ts
├── supabase/
│   └── schema.sql                    建表脚本
├── .env.example
├── next.config.js
├── package.json
└── README.md
```

---

## 模型分配规则（已实现）

| 改版方向 | 模型 | 备注 |
|---|---|---|
| 换背景 1 | gemini-3-pro-image-preview | 用户可切到 gpt-image-2 |
| 换背景 2 | gemini-3-pro-image-preview | 用户可切到 gpt-image-2 |
| 换风格 | gemini-3-pro-image-preview | 用户可切到 gpt-image-2 |
| 局部重绘 | gemini-3-pro-image-preview | 用户可切到 gpt-image-2 |
| 去水印 | bytedance/seedream-4 | **锁定，不可改** |
| 改文案 | gemini-3-pro-image-preview | 用户可切到 gpt-image-2 |
| 多语言本地化 | gemini-3-pro-image-preview | 用户可切到 gpt-image-2 |

---

## 后续要做的事（已知不完美）

1. **jarvis 真接入测试** — `lib/jarvis.ts` 是按 OpenAI 兼容协议假设写的，第一次部署后跑一次真请求看返回，按需调整字段名
2. **变体卡片下载用真图** — 当前下载逻辑直接走 `output_url`，但浏览器可能因为跨域 CORS 阻挡，需要给文件代理路由或者用 Supabase Storage 的 signed URL
3. **失败重试自动化** — 当前要手动点"重试失败"，可以加个自动重试（最多 2 次）
4. **删除参考图时同步删 Storage** — 当前删 zone 只删数据库，Storage 文件还留着
5. **接 Realtime** — 现在用轮询查任务状态，改成 Supabase Realtime 订阅会更顺滑

---

## 联系 / 问题

- 改 prompt → 编辑 `lib/modes.ts`
- 改模型分配 → 编辑 `lib/modes.ts` 的 `resolveModel()`
- 改 jarvis 调用细节 → 编辑 `lib/jarvis.ts`
- 改 UI → 编辑 `app/page.tsx` 和 `app/globals.css`

push GitHub 即自动部署。
