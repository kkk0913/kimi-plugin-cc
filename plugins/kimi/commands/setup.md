---
description: Check kimi-cli and broker connectivity
allowed-tools: Bash(node:*), Bash(kimi:*)
---

Verify that kimi-cli is installed and the broker can connect.

Run:
```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/kimi-companion.mjs" setup
```

Return the output verbatim. If setup fails, tell the user to install kimi-cli or check their login with `kimi login`.
