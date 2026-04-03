import { spawn } from "node:child_process";
import { writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

/**
 * Spawn a detached background process that writes stdout/stderr to a log file.
 * Returns the child PID.
 */
export async function spawnBackground(command, args, { logPath, cwd }) {
  await mkdir(dirname(logPath), { recursive: true });
  const { openSync, closeSync } = await import("node:fs");
  const fd = openSync(logPath, "w");
  const child = spawn(command, args, {
    cwd,
    detached: true,
    stdio: ["ignore", fd, fd],
  });
  child.unref();
  closeSync(fd);
  return child.pid;
}

/**
 * Check if a process is alive by PID.
 */
export function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Kill a process by PID (best effort).
 */
export function killProcess(pid) {
  try {
    process.kill(pid, "SIGTERM");
    return true;
  } catch {
    return false;
  }
}
