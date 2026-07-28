# 考公错题整理助手 — CLAUDE.md

> 拍照/手动录入错题 → AI 结构化 → 同步 Notion（表格+汇总双写）
> 服务器: 39.96.52.165:3100 | PM2 进程名: examtools

---

## 快速上手

```bash
# 本地开发
cd /Users/apple/Desktop/work/changshi/examTools/server
npm install
node server.js
# → http://localhost:3100

# 部署更新
cd /Users/apple/Desktop/work/changshi/examTools
tar --exclude='node_modules' --exclude='uploads' -czf /tmp/deploy.tar.gz server/
sshpass -p 'ZXk894013225@.' scp /tmp/deploy.tar.gz root@39.96.52.165:/opt/examtools/server/
sshpass -p 'ZXk894013225@.' ssh root@39.96.52.165 "cd /opt/examtools/server && tar xzf deploy.tar.gz && pm2 restart examtools"

# 推 GitHub
git config --global http.proxy http://127.0.0.1:7897
git config --global https.proxy http://127.0.0.1:7897
git add -A && git commit -m "xxx" && git push
git config --global --unset http.proxy && git config --global --unset https.proxy
```

---

## 项目架构

```
examTools/
├── server/                          # Node.js 后端（部署目录）
│   ├── server.js                    # Express 入口，端口 3100
│   ├── routes/process.js            # API 路由：识别/同步/拉取错题
│   ├── services/
│   │   ├── llm.js                   # Tesseract OCR + DeepSeek 结构化
│   │   └── notion.js                # Notion API 写入/查询（汇总页面 + 数据库）
│   ├── prompts/extract.js           # LLM 系统 Prompt（花生十三体系题型框架）
│   ├── utils/image.js               # 图片预处理
│   ├── public/                      # 前端静态页面
│   │   ├── index.html               # 主页面（AI 模式 + 手动模式）
│   │   ├── app.js                   # 前端交互逻辑
│   │   └── print.html               # 打印错题本页面
│   ├── uploads/                     # 上传的图片
│   ├── .env                         # 配置文件（API Key 等）
│   └── package.json
├── docs/                            # 方案文档
├── CLAUDE.md                        # 本文件
└── .gitignore
```

---

## 技术栈

| 层 | 技术 | 说明 |
|----|------|------|
| 后端框架 | Express (Node.js) | 轻量 Web 框架 |
| 前端 | HTML + Tailwind CDN + 原生 JS | 零构建，手机浏览器可用 |
| OCR | Tesseract.js (`chi_sim+eng`) | 中文+英文识别 |
| LLM | DeepSeek (`deepseek-v4-pro`) | HTTP API，OpenAI 兼容 SDK |
| Notion | @notionhq/client | 官方 SDK |
| 图片上传 | multer (内存存储) | 存到 server/uploads/ |
| 部署 | PM2 + scp | 进程名 `examtools` |

---

## 核心数据流

### AI 模式
```
用户拍照/选图 → OCR 提取文字 → DeepSeek 结构化（含花生体系解题框架）
    → 用户确认/编辑 → 同步到 Notion （表格新增一行 + 汇总页面追加详细内容）
```

### 手动模式
```
用户填表单（模块/题型/错误原因/答案等）+ 选填图片
    → 同步到 Notion （同上）
```

### 同步一次，做两件事
1. **表格新增一行** — 属性：模块/题型/错误原因/知识点/我的答案/正确答案/来源/原图等
2. **汇总页面追加内容** — 原图 + 标签 + 解析 + 笔记区，每条之间有分隔线

---

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/process` | 上传图片 → OCR → DeepSeek → 返回 JSON（支持 base64 或 multipart） |
| POST | `/api/sync` | 接收结构化 JSON + base64 图片 → 保存图片 → 写入 Notion |
| GET | `/api/wrong-answers` | 从 Notion 拉取所有错题（给打印页面用） |
| GET | `/api/health` | 健康检查 |

---

## Notion 数据库结构

### Database ID: `3ab83f9f-e372-81c7-a959-d2c6d1fdb2b4`
### 汇总页面 ID: `3ab83f9f-e372-8134-a6b9-c6a57e7a0a77`

| 列名 | 类型 | 说明 |
|------|------|------|
| 模块 | **Title** | 表格第一列，显示"判断推理"等 |
| 题型 | Select | 预设 12 种题型 |
| 错误原因 | Select | 6 种：知识点盲区/审题失误/掉坑/计算错误/时间不够/思路卡壳 |
| 知识点 | Multi-select | 预设 + LLM 补充 |
| 我的答案 | Rich Text | 用户的错误选项 |
| 正确答案 | Rich Text | 标准答案 |
| 来源 | Select | 历年真题/粉笔/华图/花生十三/中公 |
| 原图 | Files & Media | 外部链接（部署后才有缩略图） |
| 错题次数 | Number | 默认为 1 |
| 上次错误日期 | Date | 自动写入当天 |
| 掌握状态 | Select | 待复习/基本掌握/已掌握 |

---

## 知识点分类体系（花生十三）

Prompt 中按题型预设了专属解题框架：

| 题型 | 框架 |
|------|------|
| 逻辑填空 | 语境分析 → 词语辨析 → 排除法 |
| 片段阅读 | 行文脉络 → 找主旨 → 排除干扰 |
| 图形推理 | 定特征 → 想规律 → 验答案 |
| 逻辑判断（论证） | 识别模型 → 拆结构 → 找漏洞 |
| 逻辑判断（形式） | 翻译 → 推理 → 得结论 |
| 数学运算 | 识别题型 → 定方法 → 列式计算 |
| 资料分析 | 看问题 → 定速算方法 → 算+验 |
| 定义判断 | 提取关键词 → 匹配排除 |
| 类比推理 | 定关系 → 二级辨析 |

---

## 配置说明（.env）

```env
DEEPSEEK_API_KEY=sk-xxx                # DeepSeek API Key
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-pro
NOTION_API_KEY=ntn_xxx                  # Notion Integration Token
NOTION_DATABASE_ID=xxx                  # 错题数据库 ID
SUMMARY_PAGE_ID=xxx                     # 全部错题汇总页面 ID
PORT=3100
BASE_URL=http://39.96.52.165:3100       # 部署后改为服务器地址
HTTPS_PROXY=http://127.0.0.1:7897       # 本地开发用代理
```

---

## 完整文件清单

| 文件 | 职责 |
|------|------|
| `server.js` | Express 入口，静态文件托管，端口 3100 |
| `routes/process.js` | 3 个 API：process（识别）、sync（同步）、wrong-answers（拉取错题） |
| `services/llm.js` | OCR 调用 Tesseract.js，结构化调用 DeepSeek API |
| `services/notion.js` | Notion 写入（表格行 + 汇总页面追加）、拉取错题列表、自动重试 |
| `prompts/extract.js` | 系统 Prompt，含花生十三体系 10 个题型专属解题框架 |
| `public/index.html` | 主页面：AI 模式（上传→识别→编辑→同步）+ 手动模式（表单填写） |
| `public/app.js` | 前端交互：模式切换、图片上传、表单填充、同步提交 |
| `public/print.html` | 打印错题本页面：从 Notion 拉取数据、筛选、打印 PDF、隐藏答案 |
| `utils/image.js` | 图片校验工具 |

---

## 重要开发说明

1. **本地开发必须开代理**：`HTTPS_PROXY=http://127.0.0.1:7897`，不然连不上 Notion 和 DeepSeek
2. **服务器不需要代理**：服务器上 `HTTPS_PROXY=` 留空即可，代码已兼容空代理
3. **图片展示**：本地 `localhost` 下 Notion 原图不显示，部署到服务器后正常
4. **OCR 依赖**：第一次会下载中文语言包 `chi_sim.traineddata`（约 10MB）
5. **部署流程**：本地打包 → scp → 解压 → pm2 restart，**不要** npm install（除非 package.json 变了）
