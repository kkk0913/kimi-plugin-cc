---
name: kimi-prompting
description: Internal guidance for composing prompts for Kimi task delegation
user-invocable: false
---

# Kimi Prompting Guidelines

## Prompt Structure

Use structured XML blocks for task delegation:

```xml
<task>
  <objective>Clear, single-sentence goal</objective>
  <context>Relevant code, error messages, or background</context>
  <constraints>Scope limits, files to focus on, things to avoid</constraints>
</task>
```

## Best Practices

- Be specific about what you want analyzed
- Include relevant code snippets or file contents
- Set clear scope boundaries
- Do not combine multiple unrelated tasks in one prompt
