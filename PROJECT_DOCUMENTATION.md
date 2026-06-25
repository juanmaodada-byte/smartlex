# SmartLex - AI 语言分析平台

## 项目概述

SmartLex是一个基于AI的知识资产管理平台，利用豆包API提供多维度的知识分析和管理服务。该平台支持文本语义分析、语用学研究、知识网络可视化等功能，为知识学习者、研究者和专业人士提供强大的知识分析和管理工具。

## 技术栈

### 前端技术
- **React 19**: 现代化前端框架，支持最新的 React 特性
- **TypeScript**: 类型安全的 JavaScript 超集
- **Vite 6**: 快速的前端构建工具
- **Tailwind CSS 4**: 原子化 CSS 框架，实现高效的 UI 开发
- **Tauri 2**: 跨平台桌面应用开发框架

### 后端服务
- **Google Gemini API**: 强大的 AI 语言模型服务

### 开发工具
- **ESLint**: 代码质量检查
- **Prettier**: 代码格式化
- **Vitest**: 单元测试框架

## 项目结构

```
smartlex/
├── src/
│   ├── components/          # React 组件
│   │   ├── analysis/       # 分析相关组件
│   │   ├── AnalysisResult.tsx
│   │   ├── AnalysisStation.tsx
│   │   └── ...
│   ├── contexts/           # React Context
│   ├── hooks/              # 自定义 Hooks
│   ├── services/           # 服务层
│   ├── App.tsx            # 主应用组件
│   ├── aiService.ts       # AI 服务集成
│   └── types.ts           # TypeScript 类型定义
├── src-tauri/              # Tauri 桌面应用配置
├── public/                 # 静态资源
├── index.html             # HTML 入口
├── package.json           # 项目依赖
├── tsconfig.json          # TypeScript 配置
├── vite.config.ts         # Vite 配置
└── tailwind.config.js     # Tailwind CSS 配置
```

## 核心功能

### 1. 语言分析模块

#### 语义核心分析
- 提取文本的核心语义
- 展示语义层次结构
- 支持多语言分析

#### 语用学分析
- 分析文本的语用意图
- 识别隐含意义
- 提供语境分析

#### 语言网络
- 可视化语言关系
- 展示词汇关联
- 支持交互式探索

#### 起源故事
- 分析词汇起源
- 展示演变历史
- 提供文化背景

### 2. 聊天交互
- 自然语言对话界面
- 实时 AI 响应
- 支持多轮对话

### 3. 历史记录
- 保存分析历史
- 支持结果导出
- 历史数据管理

### 4. 个性化设置
- API 密钥配置
- 主题切换
- 分析参数调整

## 安装与运行

### 环境要求
- Node.js 20+
- npm 或 yarn

### 安装依赖
```bash
npm install
```

### 配置 API 密钥
在 `.env.local` 文件中添加：
```env
GEMINI_API_KEY=your_api_key_here
```

### 启动开发服务器
```bash
npm run dev
```

### 构建生产版本
```bash
npm run build
```

### 启动桌面应用
```bash
npm run tauri dev
```

## 部署方案

### Vercel 部署
1. 连接 GitHub 仓库
2. 配置环境变量
3. 自动构建部署

### Docker 部署
```dockerfile
# 待实现
```

## 开发指南

### 代码规范
- 使用 TypeScript 编写类型安全的代码
- 遵循 React 组件最佳实践
- 使用 Tailwind CSS 进行样式开发

### 提交规范
- feat: 新功能
- fix: 修复 bug
- docs: 文档更新
- style: 代码格式
- refactor: 代码重构
- test: 测试相关
- chore: 构建或工具更新

## 贡献指南

1. Fork 项目
2. 创建功能分支
3. 提交更改
4. 发起 Pull Request

## 许可证

MIT License

## 联系方式

- 项目维护者: [Your Name]
- 邮箱: [your.email@example.com]
- GitHub: [your-github-username]
