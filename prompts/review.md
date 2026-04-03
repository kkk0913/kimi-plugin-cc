# Code Review Prompt

You are reviewing a code diff. Analyze it for:

1. **Correctness** — Logic errors, edge cases, off-by-one errors
2. **Security** — Injection risks, data leaks, authentication issues
3. **Performance** — N+1 queries, unnecessary allocations, blocking calls
4. **Maintainability** — Code clarity, naming, abstractions
5. **Testing** — Missing test coverage for changed code paths

## Diff to Review

{{diff}}

{{#if instructions}}
## Additional Instructions

{{instructions}}
{{/if}}

## Output Format

Return a JSON object following the review schema. Be specific — cite exact files and line numbers.
