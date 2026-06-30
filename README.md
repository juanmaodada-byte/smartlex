# SmartLex

[![Version](https://img.shields.io/badge/version-0.2.0-blue)](package.json)

**阅读时不打断心流的语言资产收集与深度学习工具** — 浏览器划词即捕获，AI 深解语义，间隔重复内化。

## ✨ 功能

- **深度语义分析** — AI 拆解单词的隐喻、词源、语用场景
- **Chrome 浏览器扩展** — 阅读时不打断心流，划词即时释义 + 一键收藏
- **间隔重复** — 基于 SM-2 算法的词汇复习系统
- **知识库** — 分类/标签/搜索，构建个人语义知识网络
- **桌面应用** — Windows 原生体验，支持本地存储和通知提醒

## 📖 使用方法

### 1. 配置 API Key

打开设置页（左侧齿轮图标），填入任一 AI 提供方的 API Key：

| 提供方 | 申请地址 |
|--------|----------|
| 智谱清言 GLM | [open.bigmodel.cn](https://open.bigmodel.cn) |
| DeepSeek | [platform.deepseek.com](https://platform.deepseek.com) |
| 字节豆包 | [console.volcengine.com](https://console.volcengine.com/ark) |

点击「测试连接」确认配置正确。

### 2. 分析单词 / 短语

在首页分析工作台输入任意英语单词或短语，点击分析：

- **语义核心** — 英文释义、中文翻译、语境含义
- **词源故事** — 词汇的历史演变与文化背景
- **语用分析** — 语气、语域、使用场景
- **用法示例** — 可编辑的例句库

分析结果自动保存到知识库，右侧 AI 聊天栏可追问更多细节。

### 3. Chrome 扩展 — 阅读中捕获

1. 安装扩展（见下方下载说明）
2. 阅读任何英文网页时，**选中单词或短语**
3. 弹出释义卡片 — 即时显示基本释义 + AI 语境释义
4. 点击 **✓** 或按 **Enter** → 词条收藏到收件箱，附带原文语境和来源 URL
5. 按 **Esc** 取消，弹窗消失不打断阅读

快捷键：`Ctrl+Shift+S` 捕获当前选中文本。

### 4. 收件箱 (Inbox)

所有从浏览器捕获的词条集中在这里：

- 多选 / 批量删除 / 打标签
- 一键「分析全部」— AI 批量分析选中的词条
- 分析完成后自动移入知识库

### 5. 知识库 (Library)

已分析的词汇在此浏览和管理：

- 按标签、词性、来源域名筛选
- 时间线视图 — 按时间回顾收集的词汇
- 全文搜索 — 搜索词、释义、例句
- 批量导出（JSON / CSV）

### 6. 间隔重复复习

- 将知识库中的词条加入复习队列
- 复习面板采用翻转卡片模式：正面显示单词 + 原文语境，反面显示释义
- 根据记忆程度打分（0-5），SM-2 算法自动计算下次复习时间
- 桌面通知提醒每日复习（需在设置中开启）

## 📥 下载

前往 [Releases](https://github.com/juanmaodada-byte/smartlex/releases) 下载最新版本：

| 文件 | 说明 |
|------|------|
| `smartlex_x.x.x_x64-setup.exe` | 🖥️ Windows 安装包（推荐） |
| `smartlex_x.x.x_x64_en-US.msi` | 🖥️ MSI 安装包（企业部署） |
| `smartlex-extension-x.x.x.zip` | 🧩 Chrome 扩展（解压后开发者模式加载） |

### Chrome 扩展安装

1. 下载扩展 zip 并解压
2. 打开 `chrome://extensions/`
3. 开启右上角「开发者模式」
4. 点击「加载已解压的扩展」→ 选择解压后的文件夹

## 🛠️ 技术栈

| 层级 | 技术 |
|------|------|
| 框架 | React 19 + TypeScript |
| 构建 | Vite |
| CSS | Tailwind CSS v4 |
| 桌面 | Tauri 2 (Rust) |
| AI | 智谱 GLM / DeepSeek / 豆包 (OpenAI 兼容 API) |
| 扩展 | Chrome Extension Manifest V3 + esbuild |

## 🚀 开发

```bash
# 克隆
git clone https://github.com/juanmaodada-byte/smartlex.git
cd smartlex

# 安装依赖
npm install

# 启动 Web 开发服务器 (端口 3000)
npm run dev

# 构建 Chrome 扩展
npm run build:extension    # 输出到 dist-extension/

# 启动桌面应用
npm run tauri dev

# 构建桌面安装包
npm run tauri build
```

## 📁 项目结构

```
smartlex/
├── src/                     # React 应用源码
│   ├── components/          # UI 组件
│   │   ├── analysis/        # 分析结果子组件
│   │   ├── AnalysisStation  # 主分析工作台
│   │   ├── ChatSidebar      # AI 聊天侧边栏
│   │   └── ...
│   ├── services/            # API 调用、存储等
│   ├── hooks/               # 自定义 Hooks
│   └── contexts/            # React Context
├── extension/               # Chrome 扩展源码
│   ├── background/          # Service Worker
│   ├── content/             # 内容脚本 + Popup
│   ├── services/            # 即时查词服务
│   └── utils/               # 语境提取工具
├── shared/                  # 应用与扩展共享代码
├── src-tauri/               # Tauri 桌面后端 (Rust)
├── scripts/                 # 工具脚本
└── doc/                     # 项目文档 (本地)
```

## 🤖 AI 提供方

内置三种 AI 后端，在设置页配置 API Key 即可切换：

| 提供方 | 默认模型 |
|--------|----------|
| 智谱清言 GLM | glm-5.1 |
| DeepSeek | deepseek-v4-flash |
| 字节豆包 | doubao-seed-2-0-pro |

## 📄 许可

MIT
