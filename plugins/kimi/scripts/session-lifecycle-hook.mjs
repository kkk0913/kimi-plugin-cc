#!/usr/bin/env node
/**
 * Session lifecycle hook — manages broker process lifecycle.
 *
 * SessionStart: Lightweight — only export env vars. Broker starts lazily on first command.
 * SessionEnd:   Teardown broker, cancel running jobs, clean up.
 */

import fs from "node:fs";
import { teardownBrokerSession } from "./lib/broker-lifecycle.mjs";
import { loadState } from "./lib/state.mjs";
import { refreshJob, cancelJob } from "./lib/tracked-jobs.mjs";

const action = process.argv[2];

function readHookInput() {
  try {
    const raw = fs.readFileSync(0, "utf-8").trim();
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function appendEnvVar(name, value) {
  if (!process.env.CLAUDE_ENV_FILE || value == null || value === "") return;
  const escaped = `'${String(value).replace(/'/g, `'\"'\"'`)}'`;
  fs.appendFileSync(process.env.CLAUDE_ENV_FILE, `export ${name}=${escaped}\n`, "utf-8");
}

function onStart(input) {
  // Lightweight: only export env vars. Broker starts on demand at first command.
  appendEnvVar("KIMI_COMPANION_SESSION_ID", input.session_id);
  appendEnvVar("CLAUDE_PLUGIN_DATA", process.env.CLAUDE_PLUGIN_DATA);
}

async function onEnd() {
  // Cancel running jobs
  try {
    const state = await loadState();
    for (const entry of state.jobs || []) {
      const job = await refreshJob(entry.id);
      if (job?.status === "running") {
        await cancelJob(entry.id);
      }
    }
  } catch {}

  // Teardown broker
  try {
    await teardownBrokerSession();
  } catch {}
}

const input = readHookInput();

if (action === "SessionStart" || action === "start") {
  onStart(input);
} else if (action === "SessionEnd" || action === "end") {
  onEnd(input).catch(() => process.exit(0));
}
