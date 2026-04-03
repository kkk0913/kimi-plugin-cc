import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { spawnBackground, isAlive, killProcess } from "./process.mjs";
import { saveJob, loadJob, addJobToState, getWorkspaceDir } from "./state.mjs";
import { readFile } from "./fs.mjs";

/**
 * Create and track a background job.
 */
export async function createTrackedJob({ command, prompt, scriptArgs, cwd }) {
  const id = randomUUID().slice(0, 8);
  const wsDir = await getWorkspaceDir();
  const logPath = resolve(wsDir, "jobs", `${id}.log`);

  const scriptPath = resolve(
    new URL(".", import.meta.url).pathname,
    "..",
    "kimi-companion.mjs"
  );

  const pid = await spawnBackground(
    process.execPath,
    [scriptPath, ...scriptArgs],
    { logPath, cwd: cwd || process.cwd() }
  );

  const job = {
    id,
    pid,
    command,
    prompt,
    logPath,
    status: "running",
    startedAt: Date.now(),
    completedAt: null,
    output: null,
  };

  await saveJob(job);
  await addJobToState(job);
  return job;
}

/**
 * Refresh job status by checking if process is still alive.
 */
export async function refreshJob(jobId) {
  const job = await loadJob(jobId);
  if (!job) return null;
  if (job.status === "running" && !isAlive(job.pid)) {
    job.status = "completed";
    job.completedAt = Date.now();
    // Read output from log
    try {
      job.output = await readFile(job.logPath, "utf-8");
    } catch {
      job.output = "(no output captured)";
    }
    await saveJob(job);
  }
  return job;
}

/**
 * Cancel a running job.
 */
export async function cancelJob(jobId) {
  const job = await loadJob(jobId);
  if (!job) return null;
  if (job.status === "running") {
    killProcess(job.pid);
    job.status = "cancelled";
    job.completedAt = Date.now();
    await saveJob(job);
  }
  return job;
}

/**
 * Get log tail for a running job.
 */
export async function getJobLog(jobId, tailLines = 50) {
  const job = await loadJob(jobId);
  if (!job) return null;
  try {
    const content = await readFile(job.logPath, "utf-8");
    const lines = content.split("\n");
    return lines.slice(-tailLines).join("\n");
  } catch {
    return "(no log available)";
  }
}
