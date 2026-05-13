# 妞妞导游 · 动物园游记 AI 对话

一个面向"动物园游记 · 语言康复训练"教学场景的 AI 对话网页：

- 角色：小蜗牛"妞妞导游"（头像来自 `public/niuniu-avatar.png`）。
- 背景：动物园全景图（`public/zoo-bg.png`）。
- 教学目标：引导小朋友用「动物园里有……」「动物园里有……有……还有……」「教室里有……」「桌子上有……」「家里有……」等句式说话。
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

> 在 https://platform.deepseek.com 完成账号充值后，到「API Keys」页面创建一个 key 填入即可。R1 模型从 `deepseek-reasoner` 计费池扣，对儿童轻量对话也可以改成更便宜的 `deepseek-chat`（V3），把 `.env.local` 里的 `DEEPSEEK_MODEL` 取消注释即可。

## 2. 模块切换

页面右上角有一个圆角胶囊按钮（默认显示「课前导入」），点开后是四个模块下拉菜单，对应教学流程的四个阶段：

| ID | 名称 | 涵盖话术 |
| --- | --- | --- |
| `m1` | 模块一 · 课前导入 | 开场白、文明游园规范、老虎/狮子分组、导入动画 |
| `m2` | 模块二 · 课堂新授 | 家禽区 4 种动物 + 绘本 6 种动物 + 动物大转盘 + 逛三园 + A/B 分层策略 |
| `m3` | 模块三 · 课堂巩固 | AR 虚拟游园、进阶句式「有…有…还有…」、消消乐、抢椅子、AI 投屏、「桌子上有…」、「谁不见了」 |
| `m4` | 模块四 · 课后泛化 | 课堂总结回顾、分层作业（A/B 层）、再见结课语 |

切模块的行为：

- **对话历史保留**：切换不会清空已有对话，方便老师在一节课里顺序推进各模块。
- **新模块从下一轮起生效**：你按下「发送」之后，后端会用当前选中模块的 system prompt 回复。
- **选择持久化**：模块选择保存在浏览器 `localStorage`，刷新仍在。

## 3. 部署到 Vercel

1. 把 `web/` 推到 GitHub 一个新仓库（注意 `.env.local` 已在 `.gitignore` 里）。
2. 在 [vercel.com](https://vercel.com/new) 选择 Import Project，指向该仓库。
3. 在 Vercel 项目的 **Settings → Environment Variables** 中添加：
   - `DEEPSEEK_API_KEY` = `sk-...`
   - （可选）`DEEPSEEK_MODEL` = `deepseek-chat`
4. 点击 Deploy。Vercel 会自动用 Edge Runtime 跑 `/api/chat`，对话支持流式输出。

## 4. 目录结构

```
web/
├── app/
│   ├── api/chat/route.ts   # Edge Runtime 流式代理 DeepSeek；按 moduleId 查 system prompt
│   ├── layout.tsx
│   ├── page.tsx            # 主页：模块状态 + SSE 解析 + localStorage 历史
│   └── globals.css
├── components/
│   ├── ChatWindow.tsx      # 顶栏（头像 + 标题 + 模块下拉 + 重新开始）+ 动物园背景层 + 消息列表
│   ├── MessageBubble.tsx   # AI / 用户两种气泡
│   ├── ChatInput.tsx       # 输入框 + 发送/停止
│   └── ModuleSwitcher.tsx  # Cursor 风格模块下拉
├── lib/
│   └── systemPrompt.ts     # BASE_PERSONA + 4 个模块 + MODULES 数组 + WELCOME_MESSAGE
├── public/
│   ├── niuniu-avatar.png
│   └── zoo-bg.png
├── .env.local.example
└── package.json
```

## 5. 修改 AI 行为 / 话术

所有话术都集中在 [lib/systemPrompt.ts](lib/systemPrompt.ts) 里：

- `BASE_PERSONA`：所有模块共享的人设、说话风格、A/B 分层策略、表扬话术、安全边界。
- `MODULE_1_BODY` ~ `MODULE_4_BODY`：四个模块各自的话术 + 对话规则。
- `MODULES` 数组：每个模块的 `name` / `short` / `description` 影响下拉显示。
- `WELCOME_MESSAGE`：首屏写死的开场欢迎语。

改完保存，`npm run dev` 会热重载，重新发一条消息就能看到效果。

## 6. 安全说明

- `DEEPSEEK_API_KEY` 只读取自服务端环境变量，浏览器永远拿不到。
- 后端在转发前会：
  - 过滤掉客户端伪造的 `system` 消息，避免被注入覆盖人设。
  - 校验 `moduleId` 必须是已注册的模块；未知 ID 自动退回 `m1`，**不接受前端直接传 prompt**。
- 对话历史只存在浏览器 `localStorage`，刷新仍在，换设备/换浏览器不同步。
