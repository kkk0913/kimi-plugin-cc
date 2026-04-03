---
name: kimi-cli-runtime
description: Internal helper contract for calling the kimi-companion runtime from Claude Code
user-invocable: false
---

# Kimi CLI Runtime Contract

## Invocation

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/kimi-companion.mjs" <command> [args]
```

## Commands

| Command | Purpose |
|---------|---------|
| `setup` | Verify kimi-cli and broker connectivity |
| `review` | Code review on diff |
| `adversarial-review` | Security review |
| `task` | General task delegation |
| `status` | Job progress |
| `result` | Job output |
| `cancel` | Stop job |

## Environment Variables

- `CLAUDE_PLUGIN_ROOT`: Plugin directory (set by Claude Code)
- `CLAUDE_PLUGIN_DATA`: State directory (optional)
