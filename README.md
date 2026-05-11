# 🕐 时间去哪了 - 智能工时统计工具

<div align="center">

[![Vue](https://img.shields.io/badge/Vue-3.4-brightgreen.svg)](https://vuejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-5.0-646CFF.svg)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38B2AC.svg)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

**一款基于 AI 的智能工作时长追踪工具，让时间记录变得简单高效**

[功能介绍](#功能特点) • [快速开始](#快速开始) • [技术栈](#技术栈) • [项目结构](#项目结构) • [贡献指南](#贡献指南)

</div>

---

## ✨ 功能特点

### 🎤 零门槛录入
- **语音输入**：点击录音按钮，说一句话就能记录工作
- **键盘输入**：支持自然语言描述（如"从上午9点到11点开项目评审会"）
- **实时转写**：语音实时转文字，所见即所说

### 🤖 AI 智能分类
- **自动识别**：AI 自动分析工作内容，智能归类
- **持续学习**：随着使用次数增加，分类越来越精准
- **灵活配置**：支持自定义工作项目，随心所欲

### 📊 可视化分析
- **项目分布**：饼图展示各工作项目时长占比
- **方式分布**：清晰了解 SOLO/会议/调研的时间分配
- **趋势追踪**：折线图展示工作时长变化趋势
- **聚类统计**：AI 自动发现工作模式，发现隐藏规律

### 🔒 数据安全
- **本地存储**：所有数据保存在本地浏览器，保护隐私
- **导出导入**：支持 JSON 格式数据备份和恢复
- **离线可用**：配置 API Key 后完全离线使用

---

## 🚀 快速开始

### 环境要求

- Node.js 18+ 
- npm 9+ 或 pnpm 8+

### 安装依赖

```bash
npm install
```

### 启动开发服务器

```bash
npm run dev
```

应用将在 http://localhost:5173/ 启动

### 构建生产版本

```bash
npm run build
```

### 类型检查

```bash
npm run check
```

---

## 🛠 技术栈

| 类别 | 技术 | 说明 |
|------|------|------|
| **框架** | Vue 3 + TypeScript | 现代响应式前端框架 |
| **构建** | Vite 5.0 | 极速的开发体验 |
| **样式** | Tailwind CSS 3.4 | 实用优先的 CSS 框架 |
| **状态管理** | Pinia | Vue 官方推荐的状态管理 |
| **图表** | ECharts 6.0 | 强大的数据可视化库 |
| **AI 服务** | SiliconFlow API | 硅基流动 - Qwen2.5-7B-Instruct |
| **语音识别** | Web Speech API | 浏览器原生语音识别 |
| **数据存储** | IndexedDB + LocalStorage | 本地持久化存储 |

---

## 📁 项目结构

```
Fleets/
├── public/                    # 静态资源
├── src/
│   ├── assets/               # 资源文件
│   │   └── vue.svg          # Vue logo
│   ├── components/          # Vue 组件
│   │   ├── common/          # 通用组件
│   │   │   ├── BottomNav.vue      # 底部导航
│   │   │   ├── HeaderBar.vue      # 顶部导航栏
│   │   │   └── OnboardingModal.vue # 首次使用引导
│   │   └── record/          # 记录相关组件
│   │       ├── RecordButton.vue   # 录音按钮
│   │       ├── RecordCard.vue     # 记录卡片
│   │       └── TranscriptView.vue # 转写视图
│   ├── composables/          # 组合式函数
│   │   └── useAudioRecorder.ts   # 录音功能
│   ├── pages/               # 页面组件
│   │   ├── HomePage.vue     # 首页 - 工作录入
│   │   ├── Workbench.vue    # 工作台 - 统计分析
│   │   ├── Annotation.vue   # 待标注 - 快速标注
│   │   ├── RecordList.vue   # 记录列表
│   │   └── Settings.vue     # 设置页面
│   ├── router/              # 路由配置
│   │   └── index.ts
│   ├── stores/              # Pinia 状态库
│   │   ├── userStore.ts     # 用户配置管理
│   │   ├── recordStore.ts   # 工作记录管理
│   │   └── clusterStore.ts  # 聚类数据管理
│   ├── types/               # TypeScript 类型定义
│   │   └── index.ts
│   ├── utils/               # 工具函数
│   │   ├── ai.ts            # AI 分析接口
│   │   ├── storage.ts       # 数据存储工具
│   │   └── time.ts          # 时间处理工具
│   ├── App.vue              # 根组件
│   ├── main.ts              # 入口文件
│   └── style.css            # 全局样式
├── docs/                    # 项目文档
│   └── PRODUCT_SPEC.md      # 产品需求文档
├── index.html               # HTML 入口
├── package.json             # 项目配置
├── tsconfig.json           # TypeScript 配置
├── vite.config.ts          # Vite 配置
├── tailwind.config.js      # Tailwind CSS 配置
└── postcss.config.js       # PostCSS 配置
```

---

## 🎯 核心功能说明

### 1. 首页 - 工作录入

用户可以选择语音或键盘输入工作内容，系统通过 AI 自动分析并提取：
- ⏰ 开始/结束时间
- 📝 工作时长
- 🏷️ 工作摘要
- 📂 工作项目（智能匹配或创建新项目）
- 💼 工作方式（SOLO/会议/调研）

### 2. 工作台 - 统计分析

提供多维度数据统计：
- **项目分布饼图**：展示各工作项目的时长占比
- **方式分布饼图**：SOLO/会议/调研时间占比
- **耗时趋势图**：按日统计工作时长变化
- **聚类统计**：AI 自动发现相似工作模式
- **项目明细**：列表展示各项目统计数据

### 3. 待标注 - 快速标注

- 显示未分配工作项目的记录
- 支持一键快速标注
- 提高数据完整性

### 4. 设置 - 配置管理

- **工作项目管理**：添加、编辑、删除、标记完成
- **AI 服务配置**：配置 SiliconFlow API Key
- **数据管理**：导出、导入、清空数据

---

## 🔧 AI 配置指南

### 获取 API Key

1. 访问 [硅基流动](https://account.siliconflow.cn)
2. 注册并登录账户
3. 在个人中心获取 API Key

### 配置使用

1. 打开应用设置页面
2. 点击"配置 API Key"
3. 输入您的 SiliconFlow API Key
4. 保存后即可使用 AI 智能分析功能

### 离线模式

未配置 API Key 时，应用使用基础关键词匹配模式进行分类，建议配置 API Key 以获得更准确的识别效果。

---

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

### 开发流程

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

### 代码规范

- 使用 TypeScript 进行类型安全的开发
- 遵循 Vue 3 Composition API 最佳实践
- 代码提交前运行 `npm run check` 确保类型正确
- 使用 `npm run lint:fix` 自动修复代码风格问题

---

## 📄 许可证

本项目采用 MIT 许可证 - 详见 [LICENSE](LICENSE) 文件

---

## 🙏 致谢

- [Vue.js](https://vuejs.org/) - 渐进式 JavaScript 框架
- [Vite](https://vitejs.dev/) - 下一代前端构建工具
- [Tailwind CSS](https://tailwindcss.com/) - 实用优先的 CSS 框架
- [ECharts](https://echarts.apache.org/) - 强大的图表库
- [Pinia](https://pinia.vuejs.org/) - Vue 的状态管理
- [SiliconFlow](https://siliconflow.cn/) - AI 模型服务

---

<div align="center">

**Made with ❤️ by [tianjizhizhu](https://github.com/tianjizhizhu)**

**© 2026 时间去哪了 - 让时间记录变得简单高效**

</div>
