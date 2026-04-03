import { loadState } from "./state.mjs";
import { refreshJob, getJobLog } from "./tracked-jobs.mjs";
import { renderJobStatus } from "./render.mjs";

/**
 * List all tracked jobs with current status.
 */
export async function listJobs() {
  const state = await loadState();
  if (!state.jobs?.length) return "No jobs found.";

  const lines = [];
  for (const entry of state.jobs.slice(0, 10)) {
    const job = await refreshJob(entry.id);
    if (job) lines.push(renderJobStatus(job));
  }
  return lines.join("\n") || "No jobs found.";
}

/**
 * Get detailed result of a specific job.
 */
export async function getJobResult(jobId) {
  if (!jobId) {
    // Get most recent job
    const state = await loadState();
    if (!state.jobs?.length) return "No jobs found.";
    jobId = state.jobs[0].id;
  }

  const job = await refreshJob(jobId);
  if (!job) return `Job ${jobId} not found.`;

  if (job.status === "running") {
    const tail = await getJobLog(jobId);
    return `Job ${jobId} is still running.\n\n**Recent output:**\n${tail}`;
  }

  return job.output || "(no output)";
}
