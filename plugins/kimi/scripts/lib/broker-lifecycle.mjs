/**
 * Broker lifecycle management — start, connect, teardown.
 */
import { spawn } from "node:child_process";
import { connect } from "node:net";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readFile, writeFile, removeFile, existsSync } from "./fs.mjs";
import { getBrokerSocketPath, getBrokerPidPath } from "./broker-endpoint.mjs";
import { isAlive, killProcess } from "./process.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BROKER_SCRIPT = resolve(__dirname, "..", "app-server-broker.mjs");

const POLL_INTERVAL_MS = 100;
const POLL_TIMEOUT_MS = 15000;

/**
 * Ensure the broker is running. Starts it if not already alive.
 * Returns { socketPath, pid }.
 */
export async function ensureBrokerSession({ workDir, model, session } = {}) {
  const socketPath = await getBrokerSocketPath();
  const pidPath = await getBrokerPidPath();

  // Check if broker is already running
  if (existsSync(pidPath)) {
    try {
      const pid = parseInt(await readFile(pidPath, "utf-8"), 10);
      if (isAlive(pid)) {
        // Verify socket is reachable
        const ok = await testSocket(socketPath);
        if (ok) return { socketPath, pid };
      }
    } catch {}
    // Stale PID file — clean up
    await removeFile(pidPath);
    await removeFile(socketPath);
  }

  // Start new broker
  const args = [BROKER_SCRIPT];
  if (workDir) args.push("--work-dir", workDir);
  if (model) args.push("--model", model);
  if (session) args.push("--session", session);

  const child = spawn(process.execPath, args, {
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
    cwd: workDir || process.cwd(),
    env: { ...process.env },
  });
  child.unref();

  const pid = child.pid;
  await writeFile(pidPath, String(pid));

  // Capture early stderr for debugging
  let stderrBuf = "";
  child.stderr.on("data", (chunk) => { stderrBuf += chunk.toString(); });

  // Wait for socket to become available
  const ready = await waitForBrokerEndpoint(socketPath);
  if (!ready) {
    killProcess(pid);
    await removeFile(pidPath);
    throw new Error(`Broker failed to start within ${POLL_TIMEOUT_MS}ms. stderr: ${stderrBuf}`);
  }

  return { socketPath, pid };
}

/**
 * Poll until the broker socket accepts connections.
 */
async function waitForBrokerEndpoint(socketPath) {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const ok = await testSocket(socketPath);
    if (ok) return true;
    await sleep(POLL_INTERVAL_MS);
  }
  return false;
}

/**
 * Test if a Unix socket accepts connections.
 */
function testSocket(socketPath) {
  return new Promise((resolve) => {
    if (!existsSync(socketPath)) {
      resolve(false);
      return;
    }
    const sock = connect(socketPath);
    const timer = setTimeout(() => { sock.destroy(); resolve(false); }, 1000);
    sock.on("connect", () => { clearTimeout(timer); sock.destroy(); resolve(true); });
    sock.on("error", () => { clearTimeout(timer); resolve(false); });
  });
}

/**
 * Teardown the broker — kill process, remove socket and PID file.
 */
export async function teardownBrokerSession() {
  const pidPath = await getBrokerPidPath();
  const socketPath = await getBrokerSocketPath();

  if (existsSync(pidPath)) {
    try {
      const pid = parseInt(await readFile(pidPath, "utf-8"), 10);
      killProcess(pid);
    } catch {}
    await removeFile(pidPath);
  }
  await removeFile(socketPath);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
