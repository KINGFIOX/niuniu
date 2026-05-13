# 妞妞导游 · 动物园游记 AI 对话

一个面向"动物园游记 · 语言康复训练"教学场景的 AI 对话网页：

- 角色：小蜗牛"妞妞导游"（头像来自 `public/niuniu-avatar.png`）。
- 背景：动物园全景图（`public/zoo-bg.png`）。
- 教学目标：引导小朋友用「动物园里有……」「动物园里有……有……还有……」「教室里有……」「桌子上有……」「家里有……」等句式说话。
- 大模型：DeepSeek（默认 `deepseek-reasoner` / R1，可改 `deepseek-chat` / V3）。
- 语音：火山引擎 OpenSpeech（一句话识别 STT + 大模型 TTS），支持「按住说话」和「自动朗读」。
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

## 3. 语音输入输出

底部输入栏左侧多了一颗 **粉色麦克风按钮**：按住说话、松手识别（PTT 推压式）。妞妞每条回复会按句切片，实时送到火山 TTS，按顺序朗读。头部小喇叭按钮是 **自动朗读总开关**，关掉就立刻静音。

### 3.1 火山引擎账号配置

1. 注册 [火山引擎控制台](https://console.volcengine.com/)。
2. 进入 **豆包语音 → API 服务中心**，**开通这两个服务**（必须用新版大模型 API，旧版 v1 cluster 接口已废弃）：
   - 豆包语音合成模型 2.0 字符版（妞妞的声音）
   - 豆包录音文件识别模型 2.0 标准版（识别小朋友说的话）
3. 进入服务详情页 → **服务接口认证信息**，复制 `AppID` 和 `Access Token`。两个服务共用同一份认证。
4. 在 `web/.env.local` 中追加：

```env
VOLC_APP_ID=...
VOLC_ACCESS_TOKEN=...
VOLC_TTS_VOICE_TYPE=zh_female_vv_uranus_bigtts
# 默认 volc.seedasr.auc；如果 STT 报 "resource not granted"，改成 volc.bigasr.auc
# VOLC_ASR_RESOURCE_ID=volc.seedasr.auc
# 一般无需设置：默认按音色名自动选择 seed-tts-2.0 / seed-tts-1.0 / seed-icl-2.0
# VOLC_TTS_RESOURCE_ID=seed-tts-2.0
```

> 如果 STT 返回 403 + `resource not granted`，说明你账号开通的具体产品 resource_id 不一样：把上面注释的 `VOLC_ASR_RESOURCE_ID` 取消注释并改成 `volc.bigasr.auc` 试试。
>
> 如果 TTS 返回 403 + `resource ID is mismatched`（错误码 55000000），说明音色和资源号对不上：选 `*_uranus_bigtts` 音色（自动走 seed-tts-2.0），或者手动设置 `VOLC_TTS_RESOURCE_ID`。

### 3.2 换音色

`VOLC_TTS_VOICE_TYPE` 决定妞妞的声音，可以在火山控制台 "豆包语音 → 音色管理" 里复制任意已开通音色 ID 粘贴进来。**音色和资源号必须匹配**：

| 音色家族 | Speaker 示例 | 对应资源号（自动） |
| --- | --- | --- |
| 豆包 2.0 官方音色 | `*_uranus_bigtts`、`saturn_*` | `seed-tts-2.0` |
| 豆包 1.0 官方音色 | `*_moon_bigtts`、`*_mars_bigtts` | `seed-tts-1.0` |
| 声音复刻 2.0 | `S_xxxxx` | `seed-icl-2.0` |

推荐几个偏甜美/童趣的（**都是 2.0 字符版试用包覆盖的**）：

| 音色 ID | 风格 |
| --- | --- |
| `zh_female_vv_uranus_bigtts` | Vivi · 元气甜美少女（默认） |
| `zh_female_cancan_uranus_bigtts` | 灿灿 · 元气可爱 |
| `zh_male_m191_uranus_bigtts` | 云舟 · 阳光少年 |
| `zh_male_liufei_uranus_bigtts` | 刘飞 · 温暖大叔感 |

### 3.3 已知限制

- 录音用 `ScriptProcessorNode`（虽已标记 deprecated 但兼容性最好）。需要 HTTPS 或 `localhost`，普通 HTTP 域名无法用麦克风。
- iOS Safari 首次需要用户手势触发音频上下文，第一次点麦克风/发送按钮起就自动解锁。
- STT 走的是火山异步"submit + poll"接口，短语音（3~10s）通常 1~3s 返回，比同步接口稍慢但更稳。
- 火山按字符/秒数计费，长时间满教室连续使用建议在控制台设额度告警。
- 浏览器不支持时（如未授权麦克风 / 老 Safari）麦克风按钮会自动隐藏，仍可用文字输入。

## 4. 部署到 Vercel

1. 把 `web/` 推到 GitHub 一个新仓库（注意 `.env.local` 已在 `.gitignore` 里）。
2. 在 [vercel.com](https://vercel.com/new) 选择 Import Project，指向该仓库。
3. 在 Vercel 项目的 **Settings → Environment Variables** 中添加：
   - `DEEPSEEK_API_KEY` = `sk-...`
   - （可选）`DEEPSEEK_MODEL` = `deepseek-chat`
   - 启用语音时再加：`VOLC_APP_ID` / `VOLC_ACCESS_TOKEN` / `VOLC_TTS_VOICE_TYPE`（可选：`VOLC_TTS_RESOURCE_ID` / `VOLC_ASR_RESOURCE_ID`）
4. 点击 Deploy。Vercel 会自动用 Edge Runtime 跑 `/api/chat`、`/api/tts`、`/api/stt`，全部支持流式 / 二进制响应。

## 5. 目录结构

```
web/
├── app/
│   ├── api/
│   │   ├── chat/route.ts   # Edge Runtime 流式代理 DeepSeek；按 moduleId 查 system prompt
│   │   ├── tts/route.ts    # 火山 TTS：POST {text} → audio/mp3 二进制
│   │   └── stt/route.ts    # 火山 ASR：POST multipart audio → {text}
│   ├── layout.tsx
│   ├── page.tsx            # 主页：模块状态 + SSE 解析 + 句级 TTS + localStorage
│   └── globals.css
├── components/
│   ├── ChatWindow.tsx      # 顶栏（头像 + 模块下拉 + 朗读开关 + 重新开始）+ 背景 + 消息列表
│   ├── MessageBubble.tsx   # AI / 用户两种气泡
│   ├── ChatInput.tsx       # 输入框 + 麦克风 PTT + 发送/停止
│   ├── ModuleSwitcher.tsx  # Cursor 风格模块下拉
│   └── TtsToggle.tsx       # 自动朗读小喇叭开关
├── lib/
│   ├── systemPrompt.ts     # BASE_PERSONA + 4 个模块 + MODULES 数组 + WELCOME_MESSAGE
│   ├── volcSpeech.ts       # 服务端：火山 TTS / 短语音 ASR 调用封装
│   ├── pcmRecorder.ts      # 客户端：getUserMedia → 16kHz/16-bit/mono WAV
│   └── ttsQueue.ts         # 客户端：串行播放队列 + iOS 自动播放解锁
├── public/
│   ├── niuniu-avatar.png
│   └── zoo-bg.png
├── .env.local.example
└── package.json
```

## 6. 修改 AI 行为 / 话术

所有话术都集中在 [lib/systemPrompt.ts](lib/systemPrompt.ts) 里：

- `BASE_PERSONA`：所有模块共享的人设、说话风格、A/B 分层策略、表扬话术、安全边界。
- `MODULE_1_BODY` ~ `MODULE_4_BODY`：四个模块各自的话术 + 对话规则。
- `MODULES` 数组：每个模块的 `name` / `short` / `description` 影响下拉显示。
- `WELCOME_MESSAGE`：首屏写死的开场欢迎语。

改完保存，`npm run dev` 会热重载，重新发一条消息就能看到效果。

## 7. 安全说明

- 所有 API key（DeepSeek、火山 AppID/Token）只读取自服务端环境变量，浏览器永远拿不到。
- 后端在转发前会：
  - 过滤掉客户端伪造的 `system` 消息，避免被注入覆盖人设。
  - 校验 `moduleId` 必须是已注册的模块；未知 ID 自动退回 `m1`，**不接受前端直接传 prompt**。
  - TTS / STT 路由分别限制单次文本 500 字、音频 2MB，防滥用。
- 对话历史只存在浏览器 `localStorage`，刷新仍在，换设备/换浏览器不同步。
