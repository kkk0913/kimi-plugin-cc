/**
 * Output formatting utilities.
 */

const SEVERITY_EMOJI = {
  critical: "[CRITICAL]",
  high: "[HIGH]",
  medium: "[MEDIUM]",
  low: "[LOW]",
};

export function renderFindings(findings) {
  if (!findings || findings.length === 0) return "No findings.";
  return findings
    .map((f, i) => {
      const sev = SEVERITY_EMOJI[f.severity] || `[${f.severity}]`;
      const loc = f.file ? `${f.file}${f.line_start ? `:${f.line_start}` : ""}` : "";
      return [
        `### ${i + 1}. ${sev} ${f.title}`,
        loc ? `**Location:** \`${loc}\`` : "",
        f.body,
        f.recommendation ? `**Recommendation:** ${f.recommendation}` : "",
        f.confidence != null ? `*Confidence: ${(f.confidence * 100).toFixed(0)}%*` : "",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n---\n\n");
}

export function renderReview(review) {
  const parts = [];
  parts.push(`## Verdict: ${review.verdict === "approve" ? "APPROVE" : "NEEDS ATTENTION"}`);
  if (review.summary) parts.push(review.summary);
  if (review.findings?.length) {
    parts.push(renderFindings(review.findings));
  }
  if (review.next_steps?.length) {
    parts.push("## Next Steps");
    parts.push(review.next_steps.map((s) => `- ${s}`).join("\n"));
  }
  return parts.join("\n\n");
}

export function renderJobStatus(job) {
  const elapsed = job.startedAt ? Math.round((Date.now() - job.startedAt) / 1000) : 0;
  const status = job.status === "running" ? `Running (${elapsed}s)` : job.status;
  return `**Job ${job.id}** — ${status} — ${job.command} ${job.prompt?.slice(0, 60) || ""}`;
}
