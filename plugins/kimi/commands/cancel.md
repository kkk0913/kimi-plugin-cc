---
description: Cancel a running Kimi job
argument-hint: '<job-id>'
allowed-tools: Bash(node:*)
---

Cancel a running background Kimi job.

Raw slash-command arguments:
`$ARGUMENTS`

Execution:
```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/kimi-companion.mjs" cancel $ARGUMENTS
```
