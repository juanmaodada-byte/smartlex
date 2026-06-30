# CLAUDE.md

## 📋 必读规则 (Required Reading)

**在执行任何任务之前，必须按顺序阅读以下三个文件：**

1. **`CLAUDE.md`** (本文件) — 项目框架、架构、规则
2. **`doc/lesson.md`** — 历史 Bug 记录及其解决方案
3. **`doc/changelog.md`** — 所有开发改动的记录

**规则：**
- 每一次开发改动完成后，都必须在 `doc/changelog.md` 中记录
- 每一次遇到并解决 Bug 后，都必须在 `doc/lesson.md` 中记录
- 阅读上述文件是强制性步骤，不可跳过

---

## 项目概述

**SmartLex** 是一个阅读时不打断心流的语言资产收集与深度学习工具——浏览器划词即捕获，AI 深解语义，间隔重复内化。

- **当前版本：** v0.2.0
- **设计语言：** "Modern Scholar" — 宁静、专业、聚焦，以深邃靛蓝 + 暖灰中性色为主
- **平台：** Web (Vite) + 桌面 (Tauri 2)

---

## 技术栈

| 层级 | 技术 | 版本 |
|------|------|------|
| 框架 | React | ^19.2.3 |
| 语言 | TypeScript | ~5.8.2 |
| 构建工具 | Vite | ^6.2.0 |
| CSS | Tailwind CSS v4 + PostCSS | ^4.1.18 |
| 桌面框架 | Tauri 2 | ^2.9.5 |
| AI 提供方 | 智谱 GLM / DeepSeek / 字节豆包 | OpenAI 兼容 API |
| PDF 导出 | html2canvas + jsPDF | ^1.4.1 / ^4.0.0 |
| 桌面存储 | @tauri-apps/plugin-fs | ^2.4.5 |
| 桌面通知 | @tauri-apps/plugin-notification | ^2.3.3 |

**无状态管理库** — 使用 React Context (`StoreContext`, `ToastContext`) + `useState` + `useDebounce`。
**无路由库** — 使用枚举 `View` 的简单基于状态的视图切换。

---

## 常用命令

```bash
# 开发
npm run dev          # 启动 Vite 开发服务器 (端口 3000, 暴露于 0.0.0.0)

# 构建
npm run build        # 生产构建 → dist/
npm run preview      # 预览构建产物

# 桌面应用
npm run tauri        # 运行 Tauri CLI (npm run tauri dev / npm run tauri build)

# 测试 (目前无测试套件)
# 暂无测试命令
```

---

## 项目结构

```
smartlex/
├── src/
│   ├── components/           # React 组件
│   │   ├── analysis/         # 分析结果子组件
│   │   │   ├── ChatResult.tsx         # AI 聊天对话气泡
│   │   │   ├── LinguisticNetwork.tsx  # 词汇搭配/同义词网络
│   │   │   ├── OriginStory.tsx        # 词源故事展示
│   │   │   ├── Pragmatics.tsx         # 语用分析 (语气/语域)
│   │   │   ├── ResultHeader.tsx       # 分析结果顶部标题栏
│   │   │   ├── SemanticCore.tsx       # 核心语义 (定义/翻译)
│   │   │   └── UsageExamples.tsx      # 可编辑用法示例
│   │   ├── AnalysisResult.tsx  # 分析结果页主编排组件
│   │   ├── AnalysisStation.tsx # 主分析输入工作台 (首页)
│   │   ├── ChatSidebar.tsx     # 右侧 AI 聊天侧边栏
│   │   ├── History.tsx         # 历史记录页
│   │   ├── Library.tsx         # 知识库页 (分类/标签/搜索)
│   │   ├── Settings.tsx        # 设置页 (API Key/连接测试)
│   │   ├── Sidebar.tsx         # 左侧导航边栏
│   │   └── Toast.tsx           # Toast 通知组件
│   ├── contexts/
│   │   ├── StoreContext.tsx    # 全局数据存储 (分析/历史/知识库)
│   │   └── ToastContext.tsx    # Toast 通知提供者
│   ├── hooks/
│   │   └── useDebounce.ts      # 通用去抖 Hook (2s 延迟自动保存)
│   ├── services/
│   │   ├── apiConfig.ts        # AI 提供方配置 (GLM/DeepSeek/豆包)
│   │   ├── apiTester.ts        # API Key 连接测试
│   │   └── storageService.ts   # 三级持久化层
│   ├── aiService.ts            # AI 请求核心 (分析 + 聊天)
│   ├── App.tsx                 # 根组件 + View 路由
│   ├── index.css               # Tailwind v4 主题 + 设计系统 (@layer components)
│   ├── index.tsx               # 应用入口 (ToastProvider > StoreProvider > App)
│   └── types.ts                # TypeScript 类型定义
├── src-tauri/                  # Tauri 桌面后端 (Rust)
│   ├── src/lib.rs              # 插件初始化
│   ├── src/main.rs             # Windows 入口
│   ├── capabilities/default.json # 权限配置
│   └── tauri.conf.json         # Tauri 构建/窗口配置
├── doc/                        # 📝 项目文档
│   ├── lesson.md               # Bug 与解决方案记录
│   └── changelog.md            # 开发改动日志
├── index.html                  # HTML 入口
├── vite.config.ts              # Vite 配置 (别名 @ → ./src)
├── tailwind.config.js          # Tailwind v3 兼容配置 (v4 主体在 index.css)
├── tsconfig.json               # TypeScript 配置
├── postcss.config.js           # PostCSS (Tailwind v4 + Autoprefixer)
├── vercel.json                 # Vercel 部署配置
└── package.json
```

---

## 应用架构

### 视图路由 (View State Machine)

```typescript
enum View {
  HOME,              // 0 — AnalysisStation (分析输入)
  HISTORY,           // 1 — HistoryList (历史记录)
  LIBRARY,           // 2 — KnowledgeLibrary (知识库)
  SETTINGS,          // 3 — Settings (设置)
  ANALYSIS_RESULT    // 4 — AnalysisResult (分析结果)
}
```

三栏布局：**左侧 Sidebar** | **中央主内容** | **右侧 ChatSidebar**

### 数据流

```
用户输入 → aiService.ts → 外部 AI API (GLM/DeepSeek/豆包)
                           ↓
                    AI 返回结构化 JSON
                           ↓
                    StoreContext 更新状态
                           ↓
                    AnalysisResult 渲染子组件
                           ↓
                    useDebounce (2s) → storageService 自动保存
```

### 三级持久化策略 (`storageService.ts`)

| 优先级 | 存储方式 | 平台 | 说明 |
|--------|----------|------|------|
| 1 | 用户选择的 `.lex` 文件 | Web (File System Access API) | 支持云同步目录 |
| 2 | Tauri AppData | 桌面 | 自动保存到 `workspace.lex` |
| 3 | LocalStorage | 全平台 (回退) | 键名 `smartlex_workspace` |

---

## AI 提供方配置

| ID | 名称 | API 基础 URL | 默认模型 |
|----|------|-------------|---------|
| `glm` | 智谱清言 GLM | `open.bigmodel.cn` | glm-5.1 |
| `deepseek` | DeepSeek | `api.deepseek.com` | deepseek-v4-flash |
| `doubao` | 字节豆包 | `ark.cn-beijing.volces.com` | doubao-seed-2-0-pro-260215 |

- API Key 通过 localStorage 持久化，不存储在源码中
- `.env.local` 仅包含占位符，不提交到 Git
- 设置页面提供连接测试功能 (`apiTester.ts`)

---

## 代码规范

### TypeScript
- 所有新代码必须使用 TypeScript
- 类型定义集中放在 `src/types.ts`
- 使用 `interface` 而非 `type`（除非需要联合类型）
- 路径别名：`@/` 映射到 `src/`

### React 组件
- 使用函数组件 + Hooks
- 组件文件使用 PascalCase 命名
- 每个组件一个文件
- Props 接口命名为 `ComponentNameProps`
- 优先使用 React Context 而非 prop drilling

### CSS / Tailwind
- 使用 Tailwind v4 的 `@theme` 语法定义设计令牌（在 `index.css` 中）
- 可复用的组件样式放在 `@layer components { ... }` 中
- 暗色模式通过 `.dark` 类切换
- 不要使用行内 style，除非值是动态计算的
- 设计令牌命名遵循现有约定：`--color-primary`, `--color-bg-surface` 等

### 命名规范
- 组件：`PascalCase` (e.g., `AnalysisStation.tsx`)
- Hooks：`camelCase` 以 `use` 开头 (e.g., `useDebounce`)
- Context：`PascalCase` 以 `Context` 结尾 (e.g., `StoreContext`)
- 服务函数：`camelCase` (e.g., `callAI`, `fetchAnalysis`)
- 常量/枚举：`PascalCase` 或 `UPPER_SNAKE_CASE`

### 提交规范
- `feat:` 新功能
- `fix:` 修复 Bug
- `docs:` 文档更新
- `style:` 代码格式/UI 调整
- `refactor:` 代码重构
- `chore:` 构建/工具/依赖更新

---

## 关键注意事项

1. **无测试套件** — 目前项目没有自动化测试，改动后必须手动验证
2. **无路由库** — 不要引入 React Router 等路由库；使用现有 `View` 枚举模式
3. **AI API 兼容** — 三个 AI 提供方都使用 OpenAI 兼容的 Chat Completions API，但豆包还支持 Responses API (`aiService.ts` 中有 `callResponsesAPI`)
4. **桌面与 Web 兼容** — 代码需同时兼容浏览器和 Tauri WebView 环境；避免使用 Node.js 专有 API
5. **Tailwind v4** — 使用 `@tailwindcss/postcss` 插件，而非旧版 `tailwindcss/plugin`
6. **暗色模式** — 所有新 UI 必须同时支持亮色和暗色模式

---

## 相关文档

- [doc/changelog.md](doc/changelog.md) — 开发改动日志
- [doc/lesson.md](doc/lesson.md) — Bug 经验教训
- [PROJECT_DOC.md](PROJECT_DOC.md) — 中文技术文档
- [PROJECT_DOCUMENTATION.md](PROJECT_DOCUMENTATION.md) — 英文项目文档
- [UI_ARCHIVE.md](UI_ARCHIVE.md) — v0.1.8 旧版 UI 设计归档
