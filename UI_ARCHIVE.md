# SmartLex UI 存档 — v0.1.8 旧版界面

> 存档日期：2026-06-25  
> 目的：全面记录当前 UI 设计状态，作为全新界面设计的基线参考

---

## 一、整体设计风格

**风格定位**：Neobrutalism / Comic Book  
**特征**：
- 3px-4px 粗黑边框（`border-3 border-black`）贯穿所有组件
- 厚重实体阴影（`shadow-[4px_4px_0px_0px_#000]`）
- 大量旋转偏移（`-rotate-1`, `-rotate-2`, `rotate-1`）
- 高饱和黄色强调色（`yellow-400` / `#FCD34D`）
- 全局大写加粗小字号标签（`font-black uppercase tracking-widest`）
- 点阵背景纹理（`bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px]`）

**字体**：
- 标题/展示：Plus Jakarta Sans（`font-display`）
- 正文：Plus Jakarta Sans（`font-technical` 同族）
- 图标：Material Symbols Outlined

**暗色模式**：支持，但主色调仍为高对比度黑白边框

---

## 二、布局架构

```
┌──────────┬──────────────────────────────┬──────────────┐
│          │      黄色 Header (h-12)        │              │
│  Sidebar │  ┌─────────────────────────┐  │   Chat       │
│  (64px   │  │                         │  │   Sidebar    │
│  →256px) │  │   主内容区               │  │   (288px)    │
│          │  │   (HOME / RESULT /       │  │              │
│  首页     │  │    HISTORY / LIBRARY /   │  │   AI 助手    │
│  知识库    │  │    SETTINGS)            │  │   对话面板    │
│  ─────    │  │                         │  │              │
│  设置     │  │                         │  │              │
│          │  │                         │  │              │
└──────────┴──────────────────────────────┴──────────────┘
```

**三栏式布局**（紧凑模式隐藏侧边栏）：Sidebar | Main | ChatSidebar

---

## 三、配色系统

### 主线色彩
| Token | Value | 用途 |
|-------|-------|------|
| `--color-primary` | `#3B82F6` (blue-500) | 主行动按钮、选中态 |
| `--color-secondary` | `#EF4444` (red-500) | 分析按钮、强调操作 |
| `--color-accent` | `#EAB308` (yellow-500) | Header 底色 |
| `--color-cta` | `#10B981` | （预留） |
| `--color-background-light` | `#FFFFFF` | 浅色背景 |
| `--color-background-dark` | `#000000` | 暗色背景 |

### 场景色
| 场景 | 类名 | 描述 |
|------|------|------|
| Header | `bg-yellow-300` / `bg-yellow-400` | 亮黄色背景 + 黑色边框 |
| 选中态 | `bg-blue-500 text-white` | 蓝色填充 + 黑色边框阴影 |
| 悬停态 | `hover:bg-yellow-300` | 黄色背景变化 |
| 成功/保存 | `bg-green-500` | 绿色按钮 |
| 危险/清除 | `bg-red-500` / `text-red-500` | 红色按钮/文字 |

---

## 四、核心组件详细记录

### 4.1 左侧边栏（Sidebar.tsx）
- 宽度：`w-16 md:w-20 lg:w-64`（响应式折叠）
- Logo：`lens_blur` Material 图标 + "SMARTLEX" 文字 + "Knowledge Engine" 标语
- 导航项样式：
  - 选中：`bg-blue-500 text-white border-black shadow-[4px_4px_0px_0px_#000] -translate-y-1`
  - 未选中：`hover:border-black hover:bg-yellow-300 hover:shadow`
- 分隔线：`border-t-4 border-black border-dashed`
- 背景：`bg-white dark:bg-gray-900`

### 4.2 顶部 Header Bar（App.tsx 内）
- 高度：`h-12`
- 背景：`bg-yellow-300`
- SmartLex 标签：`bg-black text-white` 徽标 + 品牌名
- API 状态指示灯：绿点/红点 + 提供商名称 → 可点击跳转设置
- 文件同步指示器：绿点/红点 + 文件名
- 窗口置顶按钮 + 紧凑/标准模式切换

### 4.3 分析工作台（AnalysisStation.tsx）
- 点阵纹理背景
- 大标题 "深度语义分析"：`text-4xl lg:text-7xl font-display font-black italic`
- 输入卡片：黄色底色旋转偏移的"橡皮章"风格容器
  - 目标术语输入框：`text-xl lg:text-2xl font-bold`
  - 原始语境输入框（textarea）
  - 图片上传支持
- 开始分析按钮：红色大按钮 `bg-red-500 shadow-[6px_6px_0px_0px_#000]`
- 加载动画：
  - 黄色齿轮旋转 + 弹跳
  - "你知道吗？" 趣味语言知识轮播
  - 蓝色背景卡片展示英文+中文语言趣闻

### 4.4 分析结果页（AnalysisResult.tsx）
- 黄色 Header：面包屑导航 + 保存按钮
- 滚动内容区（`p-6 lg:p-12 max-w-4xl mx-auto`）
- 子组件卡片式排列：
  - ResultHeader：术语头信息
  - SemanticCore：语义核心（双列网格）
  - Pragmatics：语用学分析
  - LinguisticNetwork：语言网络可视化
  - UsageExamples：使用示例
  - OriginStory：起源故事
- 底部诊断 Footer：延迟/模型信息
- 支持 PDF 导出（html2canvas + jsPDF）
- 支持 JSON 导出

### 4.5 AI 助手侧边栏（ChatSidebar.tsx）
- 宽度：`w-72 md:w-80`
- Header：黄色背景 `bg-yellow-400`，AI 图标 + 状态指示灯
- 对话气泡：粗边框 + 阴影 + 偏移
  - 用户消息：蓝色 `bg-blue-500 text-white rounded-tr-none`
  - AI 消息：白色 `bg-white text-black rounded-tl-none`
- 输入框：粗边框 + 发送按钮（红色）
- 欢迎状态：编号引导卡片

### 4.6 知识库（Library.tsx）
- Header：白色背景 + "知识库" 大标题
- 文件同步按钮：绿色/白色霓虹风格
- 搜索框：粗边框 + 聚焦阴影
- 类型筛选标签：蓝/白切换
- 标签云过滤：标签 + 清除按钮
- Masonry 瀑布流卡片网格（2-4列响应式）
- 卡片样式：粗边框 + 阴影 + hover 旋转偏移
- 标签管理：展开式 overlay 编辑器

### 4.7 历史记录（History.tsx）
- 毛玻璃 Header（`bg-white/80 backdrop-blur-md`）
- 细边框卡片列表
- 搜索结果项：左侧图标 + 术语名 + 释义 + 日期时间

### 4.8 设置页（Settings.tsx）
- 浅灰背景 `bg-[#f8f9fa]`
- AI 模型配置卡片：三列厂商选择 + API Key 输入 + 测试连接
- 数据管理：红色危险区域警告
- 关于：版本信息 + 技术栈说明

---

## 五、现有设计的优点

1. **辨识度极高** — 粗边框+阴影的 Neobrutalism 风格让 SmartLex 在一众工具中脱颖而出
2. **交互反馈明确** — hover/active 的位移+阴影变化让用户清晰感知操作结果
3. **加载体验有趣** — 语言趣闻轮播减少了等待焦虑
4. **暗色模式完整** — 所有组件都有 dark variant

## 六、改进方向（新设计需解决）

1. **视觉噪点过多** — 大量粗边框、旋转、大写标签让界面显得拥挤凌乱
2. **信息层级不清晰** — 所有元素都"很重"，缺少主次
3. **专业感不足** — brutalist 风格更像游戏/娱乐产品而非学术工具
4. **空间利用率低** — 大量装饰性元素占据宝贵的操作空间
5. **一致性欠缺** — 历史记录/设置页与主站风格割裂（细边框 vs 粗边框）
6. **可访问性不足** — 过度依赖视觉特效，文本缩放适应性差
