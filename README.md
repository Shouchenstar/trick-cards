# Trick Cards / 技巧卡片库

**English** | [中文](#中文)

---

A structured trick card knowledge base for researchers, engineers, and AI practitioners.

Capture reusable techniques (tricks) from papers, projects, technical solutions, and product inspirations into structured cards — with cross-collection management, search, comparison, illustrations, and usage tracking.

> It's not a note-taking app. It's a **Trick Knowledge Base**.

## Features

- **Card Management** — Create, edit, and organize trick cards with difficulty levels, status tracking, and image attachments
- **Collections** — Group cards by topic or project across collections
- **Daily Review** — Spaced-repetition-style daily review for trick retention
- **Paper Tracking** — Import papers from arXiv and track reading progress
- **AI Agent** — Built-in AI assistant for card generation, search, and analysis (supports OpenAI / Anthropic / Gemini APIs)
- **Compare View** — Side-by-side comparison of cards
- **Desktop App** — Cross-platform desktop app powered by Tauri

## Tech Stack

- **Frontend**: Next.js 15 + React 19 + TypeScript + Tailwind CSS
- **Desktop**: Tauri v2
- **AI**: Multi-provider LLM integration (OpenAI-compatible / Anthropic / Gemini)

## Getting Started

```bash
# Install dependencies
npm install

# Run in browser (dev mode)
npm run dev

# Run as Tauri desktop app
npm run tauri:dev

# Build desktop app
npm run tauri:build
```

## Configuration

Copy `.env.local.example` to `.env.local` and fill in your LLM API key. You can also configure it later in the app's AI Settings panel.

---

<a id="中文"></a>

**[English](#english)** | 中文

---

面向科研人员、工程师和 AI 从业者的结构化技巧卡片知识库。

把论文、项目经验、技术方案、产品灵感中的「可复用技巧 / trick」沉淀成结构化卡片，支持跨专栏管理、搜索、对比、插图、记录使用经验。

> 它不是普通笔记软件，而是一个 **Trick 知识库**。

## 功能特性

- **卡片管理** — 创建、编辑和组织技巧卡片，支持难度分级、状态追踪和图片附件
- **专栏管理** — 按主题或项目跨专栏归组卡片
- **每日复习** — 类间隔重复的每日复习，巩固技巧记忆
- **论文追踪** — 从 arXiv 导入论文，追踪阅读进度
- **AI 助手** — 内置 AI 辅助卡片生成、搜索和分析（支持 OpenAI / Anthropic / Gemini 等主流 API）
- **对比视图** — 卡片并排对比
- **桌面应用** — 基于 Tauri 的跨平台桌面应用

## 技术栈

- **前端**: Next.js 15 + React 19 + TypeScript + Tailwind CSS
- **桌面端**: Tauri v2
- **AI**: 多 LLM 供应商接入（OpenAI 兼容协议 / Anthropic / Gemini）

## 快速开始

```bash
# 安装依赖
npm install

# 浏览器开发模式运行
npm run dev

# 以 Tauri 桌面应用运行
npm run tauri:dev

# 构建桌面应用
npm run tauri:build
```

## 配置

将 `.env.local.example` 复制为 `.env.local`，填入你的 LLM API Key。也可以在应用内右下角「AI 设置」面板中配置。