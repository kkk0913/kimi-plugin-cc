# kimi-plugin-cc

[![English](https://img.shields.io/badge/README-English-blue)](README.md)

在 Claude Code 中使用 Kimi 进行代码审查或委派任务给 Kimi。

这个插件适合希望在已有 Claude Code 工作流中轻松使用 Kimi 的用户。

> **基于 [openai/codex-plugin-cc](https://github.com/openai/codex-plugin-cc)** — 本项目深受 OpenAI 的 Codex 插件启发，并基于其架构和设计实现。

---

## 功能特性

- `/kimi:review` — 只读的 Kimi 代码审查
- `/kimi:adversarial-review` — 安全导向的挑战性审查
- `/kimi:rescue`, `/kimi:status`, `/kimi:result`, `/kimi:cancel` — 委派工作和管理后台任务

---

## 环境要求

- **Kimi CLI**（需要 `kimi` 命令在 PATH 中可用）
  - 安装地址：https://github.com/moonshot-ai/kimi-cli
  - 登录命令：`kimi login`
- **Node.js 18 或更高版本**

---

## 安装

在 Claude Code 中添加插件市场：

```
/plugin marketplace add kkk0913/kimi-plugin-cc
```

安装插件：

```
/plugin install kimi@kkk0913-kimi
```

重新加载插件。

然后运行：

`/kimi:setup` 将检查 Kimi 是否已准备就绪。

如果 Kimi CLI 已安装但未登录，请运行：

```
!kimi login
```

安装完成后，你将看到：

- 下方列出的斜杠命令
- `/agents` 中的 `kimi:kimi-rescue` 子代理

一个简单的首次运行示例：

```
/kimi:review --background
/kimi:status
/kimi:result
```

---

## 使用说明

### `/kimi:review`

对当前工作目录进行 Kimi 代码审查。

注意：代码审查（特别是多文件变更）可能需要一段时间。通常建议在后台运行。

适用场景：

- 审查当前未提交的变更
- 审查分支与基准分支（如 `main`）的差异

使用 `--base <ref>` 进行分支审查。也支持 `--background` 后台运行。

示例：

```
/kimi:review
/kimi:review --base main
/kimi:review --background
```

此命令为只读，不会执行任何代码修改。

### `/kimi:adversarial-review`

运行**安全导向**的审查，查找漏洞、注入风险、数据泄露、竞态条件和危险模式。

使用与 `/kimi:review` 相同的审查目标选择，包括 `--base <ref>` 进行分支审查。
也支持 `--background` 后台运行。

适用场景：

- 发布前的安全审查
- 专注于漏洞、注入风险、数据泄露的审查
- 针对特定风险领域（如认证、数据丢失、竞态条件、可靠性）的压力测试

示例：

```
/kimi:adversarial-review
/kimi:adversarial-review --base main
/kimi:adversarial-review --background
```

此命令为只读，不会修复代码。

### `/kimi:rescue`

通过 `kimi:kimi-rescue` 子代理将任务交给 Kimi 处理。

适用场景：

- 调查 bug
- 尝试修复
- 继续之前的 Kimi 任务

支持 `--background` 后台运行。根据任务复杂程度，通常建议在后台运行。

示例：

```
/kimi:rescue 调查测试失败的原因
/kimi:rescue 用最小安全补丁修复失败的测试
/kimi:rescue --background 调查回归问题
```

### `/kimi:status`

显示当前仓库中运行中和最近完成的 Kimi 任务。

示例：

```
/kimi:status
/kimi:status <job-id>
```

### `/kimi:result`

显示已完成任务的最终 Kimi 输出结果。

示例：

```
/kimi:result
/kimi:result <job-id>
```

### `/kimi:cancel`

取消正在运行的后台 Kimi 任务。

示例：

```
/kimi:cancel
/kimi:cancel <job-id>
```

### `/kimi:setup`

检查 Kimi CLI 是否已安装并通过身份验证。

---

## 架构设计

本插件采用基于代理（Broker）的架构：

1. **代理服务器**（`app-server-broker.mjs`）：长期运行的进程，维护单个 `kimi --wire` 子进程
2. **Unix 套接字**：命令通过 Unix 套接字使用 JSON-RPC 与代理通信
3. **Wire 协议**：代理通过 stdin/stdout 使用 Wire 协议与 Kimi CLI 通信

这种设计允许：
- 跨多个命令复用同一个 Kimi 进程
- 高效的后台任务管理
- 流式事件支持

---

## 工作原理

```
Claude Code 命令
       │
       ▼
┌─────────────┐
│   代理服务器  │◄────── 管理 `kimi --wire` 进程
│   (Broker)  │
└──────┬──────┘
       │ Unix 套接字 (JSON-RPC)
       ▼
┌─────────────┐
│  Kimi CLI   │◄────── Kimi AI 处理
│  (--wire)   │
└─────────────┘
```

---

## 许可证

根据 Apache 许可证 2.0 版（"许可证"）授权；
除非遵守许可证，否则您不得使用此文件。
您可以在以下网址获取许可证副本：

    http://www.apache.org/licenses/LICENSE-2.0

除非适用法律要求或书面同意，否则根据许可证分发的软件
按"原样"分发，不提供任何明示或暗示的保证或条件。
请参阅许可证以了解管理权限和限制的特定语言。

---

## 致谢

本项目基于 OpenAI 的 [openai/codex-plugin-cc](https://github.com/openai/codex-plugin-cc) 项目。架构、命令结构和许多实现模式均源自他们的优秀工作。
