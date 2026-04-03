---
description: Delegate investigation or fix to Kimi
argument-hint: '<task description> [--model <model>] [--context <file>]'
disable-model-invocation: true
allowed-tools: Read, Glob, Grep, Bash(node:*), Bash(git:*)
---

Delegate a coding task, investigation, or bug fix to Kimi via kimi-cli Wire IPC.

Raw slash-command arguments:
`$ARGUMENTS`

Execution:
```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/kimi-companion.mjs" task $ARGUMENTS
```

Return Kimi's output verbatim. Do NOT apply any code changes — wait for the user to explicitly ask.
