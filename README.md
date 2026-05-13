# 妞妞导游 · 动物园游记 AI 对话

一个面向"动物园游记 · 语言康复训练"教学场景的 AI 对话网页：

- 角色：小蜗牛"妞妞"导游（头像来自 `public/niuniu-avatar.png`）。
- 背景：动物园全景图（`public/zoo-bg.png`）。
- 教学目标：引导小朋友用「动物园里有……」「动物园里有……有……还有……」等句式说话。
- 大模型：DeepSeek（默认 `deepseek-reasoner` / R1，可改 `deepseek-chat` / V3）。
- 技术栈：Next.js 14 (App Router) + TypeScript + Tailwind CSS，Edge Runtime 流式代理。

## 1. 本地运行

```bash
cd web
npm install
cp .env.local.example .env.local
# 把 .env.local 里的 DEEPSEEK_API_KEY 改成你自己的真 key
npm run dev
```

浏览器打开 http://localhost:3000 即可。

> 在 https://platform.deepseek.com 完成账号充值后，到「API Keys」页面创建一个 key 填入即可。R1 模型的余额从 `deepseek-reasoner` 计费池扣，对儿童轻量对话也可以改成更便宜的 `deepseek-chat`（V3），把 `.env.local` 里的 `DEEPSEEK_MODEL` 取消注释即可。

## 2. 部署到 Vercel

1. 把 `web/` 推到 GitHub 一个新仓库（注意 `.env.local` 已在 `.gitignore` 里）。
2. 在 [vercel.com](https://vercel.com/new) 选择 Import Project，指向该仓库。
3. 在 Vercel 项目的 **Settings → Environment Variables** 中添加：
   - `DEEPSEEK_API_KEY` = `sk-...`
   - （可选）`DEEPSEEK_MODEL` = `deepseek-chat`
4. 点击 Deploy。Vercel 会自动用 Edge Runtime 跑 `/api/chat`，对话支持流式输出。

## 3. 目录结构

```
web/
├── app/
│   ├── api/chat/route.ts   # Edge Runtime 流式代理 DeepSeek
│   ├── layout.tsx
│   ├── page.tsx            # 主聊天页（SSE 解析 + localStorage 历史）
│   └── globals.css
├── components/
│   ├── ChatWindow.tsx      # 顶栏 + 动物园背景层 + 消息列表
│   ├── MessageBubble.tsx   # AI / 用户两种气泡
│   └── ChatInput.tsx       # 输入框 + 发送/停止
├── lib/
│   └── systemPrompt.ts     # 妞妞角色设定 + 知识库 system prompt
├── public/
│   ├── niuniu-avatar.png
│   └── zoo-bg.png
├── .env.local.example
└── package.json
```

## 4. 修改 AI 行为

所有教学话术、动物百科、A/B 分层策略、表扬话术等都集中写在 [lib/systemPrompt.ts](lib/systemPrompt.ts) 的 `SYSTEM_PROMPT` 字符串里，直接改它就能调整妞妞的人设和教学策略。

前端写死的开场欢迎语在同文件的 `WELCOME_MESSAGE`，改它就改首屏问候。

## 5. 安全说明

- `DEEPSEEK_API_KEY` 只读取自服务端环境变量，浏览器永远拿不到。
- 后端在转发前会过滤掉客户端伪造的 `system` 消息，避免被注入覆盖人设。
- 对话历史只存在浏览器 `localStorage`，刷新仍在，换设备/换浏览器不同步。
