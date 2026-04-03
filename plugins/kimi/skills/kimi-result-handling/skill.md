---
name: kimi-result-handling
description: Internal guidance for presenting Kimi output back to the user
user-invocable: false
---

# Kimi Result Handling

## Core Rule

**Present findings, then STOP. Do not make code changes.**

- Return Kimi's output exactly as received — no paraphrasing
- Do NOT apply code changes without explicit user consent
- Preserve severity ordering, file paths, line numbers
- Show token usage when available
