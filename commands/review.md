---
description: Delegate code review to Kimi via kimi-cli
argument-hint: '[--background] [--base <ref>] [--model <model>]'
disable-model-invocation: true
allowed-tools: Read, Glob, Grep, Bash(node:*), Bash(git:*)
---

Run a Kimi code review through the kimi-cli Wire IPC.

Raw slash-command arguments:
`$ARGUMENTS`

Core constraint:
- This command is review-only.
- Do not fix issues or apply patches.
- Return Kimi's output verbatim to the user.

Execution:
```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/kimi-companion.mjs" review $ARGUMENTS
```

If `--background` is passed, launch with `run_in_background: true` and tell the user to check `/kimi:status`.

Return the command stdout verbatim, exactly as-is. Do not paraphrase, summarize, or add commentary.
