#!/usr/bin/env node
/**
 * Session lifecycle hook — manages broker process lifecycle.
 *
 * sessionStart: Ensure broker is running (spawns kimi --wire if needed).
 * sessionEnd:   Teardown broker, cancel running jobs, clean up.
 */

import { ensureBrokerSession, teardownBrokerSession } from "./lib/broker-lifecycle.mjs";
import { loadState } from "./lib/state.mjs";
import { refreshJob, cancelJob } from "./lib/tracked-jobs.mjs";

const action = process.argv[2];

async function onStart() {
  try {
    const { socketPath, pid } = await ensureBrokerSession({
      workDir: process.cwd(),
    });
    process.stdout.write(`Kimi broker started (pid=${pid}, socket=${socketPath})\n`);
  } catch (err) {
    // Non-fatal — broker will start lazily on first command
    process.stderr.write(`Broker pre-start failed (will retry lazily): ${err.message}\n`);
  }
}

async function onEnd() {
  // Cancel running jobs
  try {
    const state = await loadState();
    for (const entry of state.jobs || []) {
      const job = await refreshJob(entry.id);
      if (job?.status === "running") {
        await cancelJob(entry.id);
        process.stdout.write(`Cancelled job: ${entry.id}\n`);
      }
    }
  } catch {}

  // Teardown broker
  try {
    await teardownBrokerSession();
    process.stdout.write("Kimi broker stopped.\n");
  } catch {}
}

if (action === "SessionStart" || action === "start") {
  onStart().catch(() => process.exit(0));
} else if (action === "SessionEnd" || action === "end") {
  onEnd().catch(() => process.exit(0));
}
