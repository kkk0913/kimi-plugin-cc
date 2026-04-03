# kimi-plugin-cc

[![中文](https://img.shields.io/badge/README-中文-blue)](README.zh-CN.md)

Use Kimi from inside Claude Code for code reviews or to delegate tasks to Kimi.

This plugin is for Claude Code users who want an easy way to start using Kimi from the workflow they already have.

> **Based on [openai/codex-plugin-cc](https://github.com/openai/codex-plugin-cc)** — This project is heavily inspired by and based on the architecture and design of the Codex plugin for Claude Code.

---

## What You Get

- `/kimi:review` for a normal read-only Kimi code review
- `/kimi:adversarial-review` for a security-focused challenge review
- `/kimi:rescue`, `/kimi:status`, `/kimi:result`, and `/kimi:cancel` to delegate work and manage background jobs

---

## Requirements

- **Kimi CLI** (`kimi` command available in PATH)
  - Install from: https://github.com/moonshot-ai/kimi-cli
  - Login with: `kimi login`
- **Node.js 18 or later**

---

## Install

Add the marketplace in Claude Code:

```
/plugin marketplace add kkk0913/kimi-plugin-cc
```

Install the plugin:

```
/plugin install kimi@kkk0913-kimi
```

Reload plugins.

Then run:

`/kimi:setup` will tell you whether Kimi is ready.

If Kimi CLI is installed but not logged in yet, run:

```
!kimi login
```

After install, you should see:

- the slash commands listed below
- the `kimi:kimi-rescue` subagent in `/agents`

One simple first run is:

```
/kimi:review --background
/kimi:status
/kimi:result
```

---

## Usage

### `/kimi:review`

Runs a Kimi code review on your current work.

Note: Code review especially for multi-file changes might take a while. It's generally recommended to run it in the background.

Use it when you want:

- a review of your current uncommitted changes
- a review of your branch compared to a base branch like `main`

Use `--base <ref>` for branch review. It also supports `--background`.

Examples:

```
/kimi:review
/kimi:review --base main
/kimi:review --background
```

This command is read-only and will not perform any changes.

### `/kimi:adversarial-review`

Runs a **security-focused** review that looks for vulnerabilities, injection risks, data leaks, race conditions, and dangerous patterns.

It uses the same review target selection as `/kimi:review`, including `--base <ref>` for branch review.
It also supports `--background`.

Use it when you want:

- a security review before shipping
- review focused on vulnerabilities, injection risks, data leaks
- pressure-testing around specific risk areas like auth, data loss, race conditions, or reliability

Examples:

```
/kimi:adversarial-review
/kimi:adversarial-review --base main
/kimi:adversarial-review --background
```

This command is read-only. It does not fix code.

### `/kimi:rescue`

Hands a task to Kimi through the `kimi:kimi-rescue` subagent.

Use it when you want Kimi to:

- investigate a bug
- try a fix
- continue a previous Kimi task

It supports `--background`. Depending on the task, it's generally recommended to run in the background.

Examples:

```
/kimi:rescue investigate why the tests started failing
/kimi:rescue fix the failing test with the smallest safe patch
/kimi:rescue --background investigate the regression
```

### `/kimi:status`

Shows running and recent Kimi jobs for the current repository.

Examples:

```
/kimi:status
/kimi:status <job-id>
```

### `/kimi:result`

Shows the final stored Kimi output for a finished job.

Examples:

```
/kimi:result
/kimi:result <job-id>
```

### `/kimi:cancel`

Cancels an active background Kimi job.

Examples:

```
/kimi:cancel
/kimi:cancel <job-id>
```

### `/kimi:setup`

Checks whether Kimi CLI is installed and authenticated.

---

## Architecture

The plugin uses a broker-based architecture:

1. **Broker** (`app-server-broker.mjs`): A long-lived process that maintains a single `kimi --wire` subprocess
2. **Unix Socket**: Commands communicate with the broker via JSON-RPC over Unix socket
3. **Wire Protocol**: The broker communicates with Kimi CLI via stdin/stdout using the Wire protocol

This design allows:
- Reusing the same Kimi process across multiple commands
- Efficient background task management
- Streaming event support

---

## How It Works

```
Claude Code Command
       │
       ▼
┌─────────────┐
│   Broker    │◄────── Manages `kimi --wire` process
│   Server    │
└──────┬──────┘
       │ Unix Socket (JSON-RPC)
       ▼
┌─────────────┐
│  Kimi CLI   │◄────── Kimi AI processing
│  (--wire)   │
└─────────────┘
```

---

## License

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

---

## Acknowledgments

This project is based on the [openai/codex-plugin-cc](https://github.com/openai/codex-plugin-cc) project by OpenAI. The architecture, command structure, and many implementation patterns are derived from their excellent work.
