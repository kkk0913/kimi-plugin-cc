---
description: Get completed Kimi job output
argument-hint: '[job-id]'
allowed-tools: Bash(node:*)
---

Retrieve the output of a completed background Kimi job.

Raw slash-command arguments:
`$ARGUMENTS`

Execution:
```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/kimi-companion.mjs" result $ARGUMENTS
```

Return the output verbatim. Do NOT auto-apply code changes.
