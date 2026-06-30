# SmartLex

[![Version](https://img.shields.io/badge/version-0.2.0-blue)](package.json)

**AI 驱动的深度语义分析引擎** — 一个"语义实验室"，解析英语单词和短语背后的隐喻逻辑、文化背景、语用细节和词源。

## ✨ 功能

- **深度语义分析** — AI 拆解单词的隐喻、词源、语用场景
- **Chrome 浏览器扩展** — 阅读时不打断心流，划词即时释义 + 一键收藏
- **间隔重复** — 基于 SM-2 算法的词汇复习系统
- **知识库** — 分类/标签/搜索，构建个人语义知识网络
- **桌面应用** — Windows 原生体验，支持本地存储和通知提醒

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
