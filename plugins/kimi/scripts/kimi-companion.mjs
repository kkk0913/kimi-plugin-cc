#!/usr/bin/env node
/**
 * kimi-companion — main CLI entry point for the Kimi plugin.
 *
 * All commands communicate with a long-lived `kimi --wire` process via
 * the broker (Unix socket JSON-RPC). The broker is started automatically
 * on first use and cleaned up on session end.
 *
 * Commands:
 *   setup                          Verify kimi-cli and broker connectivity
 *   review [--base <ref>] [--model <m>] [--background]
 *   adversarial-review [--base <ref>] [--model <m>] [--background]
 *   task <prompt> [--model <m>] [--context <file>]
 *   status [job-id]                Show job progress
 *   result [job-id]                Get completed job output
 *   cancel <job-id>                Cancel a running job
 */

import { parseArgs } from "./lib/args.mjs";
import { ensureBrokerSession } from "./lib/broker-lifecycle.mjs";
import { connectToBroker } from "./lib/broker-client.mjs";
import { diff, diffStat } from "./lib/git.mjs";
import { renderReview } from "./lib/render.mjs";
import { listJobs, getJobResult } from "./lib/job-control.mjs";
import { createTrackedJob, cancelJob } from "./lib/tracked-jobs.mjs";
import { readFile } from "./lib/fs.mjs";

const { flags, positional } = parseArgs(process.argv.slice(2));
const command = positional[0];

/**
 * Get a connected broker client. Starts broker if needed.
 */
async function getBrokerClient() {
  await ensureBrokerSession({
    workDir: flags["work-dir"] || process.cwd(),
    model: flags.model,
  });
  return connectToBroker();
}

// ─── Commands ──────────────────────────────────────────────────────────────

async function cmdSetup() {
  // Check kimi binary exists
  const { execFileSync } = await import("node:child_process");
  try {
    const info = execFileSync("kimi", ["info"], { timeout: 5000 }).toString();
    console.log("kimi-cli found:\n" + info);
  } catch {
    console.error("Error: kimi-cli not found in PATH. Install it first.");
    process.exit(1);
  }

  // Check broker connectivity
  console.log("Starting broker & kimi Wire process...");
  try {
    const client = await getBrokerClient();
    const ping = await client.ping();
    console.log(`Broker connected. kimi alive: ${ping.alive}`);
    client.close();
    console.log("\nSetup complete. Kimi plugin is ready.");
  } catch (err) {
    console.error(`Broker connection failed: ${err.message}`);
    process.exit(1);
  }
}

async function cmdReview() {
  const base = flags.base || null;
  const background = flags.background === true;

  if (background) {
    const job = await createTrackedJob({
      command: "review",
      prompt: `review --base=${base || "HEAD"}`,
      scriptArgs: ["review", ...(base ? ["--base", base] : [])],
    });
    console.log(`Background review started. Job ID: ${job.id}\nCheck progress: /kimi:status ${job.id}`);
    return;
  }

  console.log("Generating diff...");
  const diffContent = await diff(base);
  if (!diffContent.trim()) {
    console.log("No changes to review.");
    return;
  }

  const stat = await diffStat(base);
  console.log(`Reviewing changes:\n${stat}\n`);

  const extraInstructions = positional.slice(1).join(" ");

  // Build review prompt for kimi
  const prompt = buildReviewPrompt(diffContent, extraInstructions);

  const client = await getBrokerClient();
  try {
    const result = await client.prompt(prompt, {
      onEvent: (e) => streamProgress(e),
    });

    // Try to parse structured review from kimi's response
    const review = tryParseReview(result.text);
    if (review) {
      console.log("\n" + renderReview(review));
    } else {
      console.log("\n## Review Output\n");
      console.log(result.text);
    }
  } finally {
    client.close();
  }
}

async function cmdAdversarialReview() {
  const base = flags.base || null;
  const background = flags.background === true;

  if (background) {
    const job = await createTrackedJob({
      command: "adversarial-review",
      prompt: `adversarial-review --base=${base || "HEAD"}`,
      scriptArgs: ["adversarial-review", ...(base ? ["--base", base] : [])],
    });
    console.log(`Background adversarial review started. Job ID: ${job.id}\nCheck: /kimi:status ${job.id}`);
    return;
  }

  console.log("Generating diff...");
  const diffContent = await diff(base);
  if (!diffContent.trim()) {
    console.log("No changes to review.");
    return;
  }

  const stat = await diffStat(base);
  console.log(`Adversarial security review of:\n${stat}\n`);

  const prompt = buildAdversarialPrompt(diffContent);

  const client = await getBrokerClient();
  try {
    const result = await client.prompt(prompt, {
      onEvent: (e) => streamProgress(e),
    });

    const review = tryParseReview(result.text);
    if (review) {
      console.log("\n" + renderReview(review));
    } else {
      console.log("\n## Adversarial Review Output\n");
      console.log(result.text);
    }
  } finally {
    client.close();
  }
}

async function cmdTask() {
  const userPrompt = positional.slice(1).join(" ");
  const background = flags.background === true;

  if (!userPrompt) {
    console.error("Error: task requires a prompt.\nUsage: kimi-companion task 'fix the bug in auth.js'");
    process.exit(1);
  }

  // Load optional context file
  let context = "";
  if (flags.context) {
    try {
      context = await readFile(flags.context, "utf-8");
    } catch {
      console.error(`Warning: could not read context file ${flags.context}`);
    }
  }

  if (background) {
    const job = await createTrackedJob({
      command: "task",
      prompt: userPrompt,
      scriptArgs: [
        "task", userPrompt,
        ...(flags.model ? ["--model", flags.model] : []),
        ...(flags.context ? ["--context", flags.context] : []),
      ],
    });
    console.log(`Background task started. Job ID: ${job.id}\nCheck: /kimi:status ${job.id}`);
    return;
  }

  const fullPrompt = context
    ? `Context:\n\`\`\`\n${context}\n\`\`\`\n\nTask: ${userPrompt}`
    : userPrompt;

  const client = await getBrokerClient();
  try {
    const result = await client.prompt(fullPrompt, {
      onEvent: (e) => streamProgress(e),
    });
    console.log("\n" + result.text);
  } finally {
    client.close();
  }
}

async function cmdStatus() {
  const jobId = positional[1] || null;
  if (jobId) {
    console.log(await getJobResult(jobId));
  } else {
    // Also show broker status
    try {
      const client = await getBrokerClient();
      const st = await client.status();
      console.log(`Broker: kimi_pid=${st.kimi_pid} alive=${st.kimi_alive} queue=${st.queue_length}`);
      client.close();
    } catch {
      console.log("Broker: not running");
    }
    console.log("\n" + await listJobs());
  }
}

async function cmdResult() {
  const jobId = positional[1] || null;
  console.log(await getJobResult(jobId));
}

async function cmdCancel() {
  const jobId = positional[1];
  if (!jobId) {
    // Cancel active kimi turn via broker
    try {
      const client = await getBrokerClient();
      await client.cancel();
      console.log("Active turn cancelled.");
      client.close();
    } catch (err) {
      console.error(`Cancel failed: ${err.message}`);
    }
    return;
  }
  const job = await cancelJob(jobId);
  if (job) {
    console.log(`Job ${jobId} cancelled.`);
  } else {
    console.log(`Job ${jobId} not found.`);
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function buildReviewPrompt(diffContent, extra) {
  let p = `Please review this code diff carefully. For each issue found, report:
- Severity (critical/high/medium/low)
- File and line number
- What the problem is
- How to fix it

Return your findings as a JSON object with this structure:
{"verdict":"approve"|"needs-attention","summary":"...","findings":[{"severity":"...","title":"...","body":"...","file":"...","line_start":N,"confidence":0.0-1.0,"recommendation":"..."}],"next_steps":["..."]}

Diff:
\`\`\`diff
${diffContent}
\`\`\``;

  if (extra) p += `\n\nAdditional instructions: ${extra}`;
  return p;
}

function buildAdversarialPrompt(diffContent) {
  return `You are a security-focused adversarial reviewer. Find vulnerabilities, injection risks, data leaks, race conditions, and dangerous patterns. Challenge every assumption.

Return findings as JSON: {"verdict":"approve"|"needs-attention","summary":"...","findings":[{"severity":"...","title":"...","body":"...","file":"...","line_start":N,"confidence":0.0-1.0,"recommendation":"..."}],"next_steps":["..."]}

Diff:
\`\`\`diff
${diffContent}
\`\`\``;
}

function tryParseReview(text) {
  if (!text) return null;
  // Try to extract JSON from the response
  const jsonMatch = text.match(/\{[\s\S]*"verdict"[\s\S]*"findings"[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch {}
  }
  // Try stripping markdown code fences
  const fenced = text.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
  if (fenced) {
    try {
      return JSON.parse(fenced[1]);
    } catch {}
  }
  return null;
}

function streamProgress(event) {
  // Wire event format: params.type + params.payload
  if (event.params?.type === "StatusUpdate") {
    const msg = event.params.payload?.message || "";
    if (msg) process.stderr.write(`[kimi] ${msg}\n`);
  }
}

// ─── Route ─────────────────────────────────────────────────────────────────

const commands = {
  setup: cmdSetup,
  review: cmdReview,
  "adversarial-review": cmdAdversarialReview,
  task: cmdTask,
  status: cmdStatus,
  result: cmdResult,
  cancel: cmdCancel,
};

const handler = commands[command];
if (!handler) {
  console.error(
    `Unknown command: ${command || "(none)"}\n\nAvailable: ${Object.keys(commands).join(", ")}`
  );
  process.exit(1);
}

handler().catch((err) => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
