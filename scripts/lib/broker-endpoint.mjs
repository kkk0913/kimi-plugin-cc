/**
 * Broker endpoint utilities — Unix socket path management.
 */
import { resolve } from "node:path";
import { getWorkspaceDir } from "./state.mjs";

const IS_WIN = process.platform === "win32";

/**
 * Get the broker socket path for the current workspace.
 */
export async function getBrokerSocketPath() {
  const wsDir = await getWorkspaceDir();
  if (IS_WIN) {
    // Named pipe on Windows
    const slug = wsDir.split(/[\\/]/).pop();
    return `\\\\.\\pipe\\kimi-plugin-cc-${slug}`;
  }
  return resolve(wsDir, "broker.sock");
}

/**
 * Get the broker PID file path.
 */
export async function getBrokerPidPath() {
  const wsDir = await getWorkspaceDir();
  return resolve(wsDir, "broker.pid");
}
