# Chatbox++

> 简洁美观的 AI 对话桌面应用 · v1.3.0

Chatbox++ 是一个基于 Electron（electron-vite + TypeScript + React）构建的桌面应用，
通过调用 OpenAI 兼容格式的 API 与大模型对话。用户自行提供 API Key，应用不内置任何 AI 服务。

## ✨ 功能特性

- **多模型管理**：可配置多个模型，每个模型独立填写 API Key、API 地址、模型 ID
- **多会话管理**：可创建多个对话，每个对话独立保存历史，支持重命名与删除
- **完整生成参数**：可在配置模型时设置 `temperature`、`top_p`、`n`、`presence_penalty`、`frequency_penalty`、`max_tokens`
- **思考模式**：
  - 选择思考类型：仅思考 / 仅非思考 / 可在对话时选择是否思考
  - 对支持思考的模型，可勾选该模型支持的所有思考强度等级（`low`、`medium`、`high`、`xhigh`、`max`）
  - 对话界面提供思考模式开关与强度选择，强度只能在配置时勾选的等级中选择
- **流式输出**：实时展示模型回复与思考过程
- **Markdown 渲染**：支持 GFM 表格、代码块、列表等
- **浅色 / 深色 / 跟随系统** 三种主题
- **数据本地持久化**：所有配置与对话存储在用户数据目录

## 🚀 快速开始

### 环境要求

- Node.js 20.19+（或 22.12+）
- npm（或 pnpm / yarn）

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

### 启动（预览生产构建）

```bash
npm start
```

`npm start` 采用「非必要不重新构建」策略：

- 若已存在构建产物（`out/main/index.js`），则**直接启动 Electron，跳过构建**
- 若不存在产物，则自动构建一次再启动
- 需要强制重建时使用 `npm start -- --rebuild` 或 `npm run start:rebuild`

> 提示：修改源码后若希望 `npm start` 反映最新改动，请先 `npm run build`，或使用带 `--rebuild` 的启动命令。开发阶段推荐使用 `npm run dev`（带热重载）。

### 类型检查

```bash
npm run typecheck
```

### 构建生产版本

```bash
npm run build
```

### 打包成安装包

```bash
# Windows
npm run build:win
# macOS
npm run build:mac
# Linux
npm run build:linux
```

## 📖 使用指南

1. 首次启动后，点击左下角「设置」→「模型管理」→「添加模型」
2. 填写模型显示名称、API 基础地址（如 `https://api.openai.com/v1`）、API Key、模型 ID（如 `gpt-4o`）
3. 按需调整生成参数与思考模式设置
4. 返回主界面，点击「新对话」，在顶部选择模型后即可开始对话
5. 若模型设置为「可在对话时选择是否思考」，可在对话界面顶部切换思考开关与强度

## 🏗️ 项目结构

```
Chatbox++/
├── src/
│   ├── main/              # 主进程
│   │   ├── index.ts       # 应用入口、窗口创建
│   │   ├── store.ts       # 本地数据持久化
│   │   ├── chat.ts        # 流式对话请求
│   │   └── ipc.ts         # IPC 通信处理
│   ├── preload/           # 预加载脚本
│   │   ├── index.ts       # contextBridge 暴露 API
│   │   └── index.d.ts     # 类型声明
│   ├── renderer/          # 渲染进程
│   │   ├── index.html
│   │   └── src/
│   │       ├── main.tsx   # React 入口
│   │       ├── App.tsx    # 根组件
│   │       ├── store/     # Zustand 状态管理
│   │       ├── components/ # UI 组件
│   │       └── styles/    # 全局样式
│   └── shared/            # 共享类型定义
│       └── types.ts
├── electron.vite.config.ts
├── electron-builder.yml
├── package.json
└── tsconfig*.json
```

## 🔐 安全说明

- API Key 仅存储在本地用户数据目录，不会上传到任何服务器
- 渲染进程启用上下文隔离（contextIsolation）与沙箱（sandbox），禁用 Node 集成
- 网络请求由主进程通过 `net.fetch` 发起，符合 Electron 安全最佳实践

## 📦 依赖说明

| 依赖 | 用途 |
| --- | --- |
| `@electron-toolkit/utils` | Electron 开发工具 |
| `react` / `react-dom` | UI 框架 |
| `react-markdown` | Markdown 渲染 |
| `remark-gfm` | GFM 语法支持 |
| `zustand` | 状态管理 |
| `electron` | 桌面应用框架 |
| `electron-vite` | 构建工具 |
| `electron-builder` | 打包工具 |
| `typescript` | 类型系统 |
| `vite` | 前端构建 |
| `@vitejs/plugin-react` | React 支持 |

## 📄 许可证

MIT
