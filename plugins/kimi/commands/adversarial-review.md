---
description: Security-focused adversarial code review via Kimi
argument-hint: '[--background] [--base <ref>] [--model <model>]'
disable-model-invocation: true
allowed-tools: Read, Glob, Grep, Bash(node:*), Bash(git:*)
---

Run a security-focused adversarial review via Kimi.

Raw slash-command arguments:
`$ARGUMENTS`

Execution:
```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/kimi-companion.mjs" adversarial-review $ARGUMENTS
```

If `--background` is passed, launch with `run_in_background: true`.

Return the command stdout verbatim. Do not auto-fix. Do not paraphrase.
