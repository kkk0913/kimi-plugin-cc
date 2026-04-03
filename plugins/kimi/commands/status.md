---
description: Show progress of background Kimi jobs
argument-hint: '[job-id]'
allowed-tools: Bash(node:*)
---

Show the status of background Kimi jobs.

Raw slash-command arguments:
`$ARGUMENTS`

Execution:
```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/kimi-companion.mjs" status $ARGUMENTS
```

Return the output verbatim.
