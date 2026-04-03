import { execFile } from "node:child_process";

function run(args, cwd) {
  return new Promise((resolve, reject) => {
    execFile("git", args, { cwd, timeout: 30000, maxBuffer: 10 * 1024 * 1024 }, (err, stdout) => {
      if (err) reject(err);
      else resolve(stdout);
    });
  });
}

export async function diff(base, cwd) {
  const args = base ? ["diff", base] : ["diff", "--cached"];
  // Fall back to unstaged diff if cached is empty
  let out = await run(args, cwd);
  if (!out && !base) {
    out = await run(["diff"], cwd);
  }
  // Fall back to diff against HEAD
  if (!out && !base) {
    out = await run(["diff", "HEAD"], cwd);
  }
  return out;
}

export async function diffStat(base, cwd) {
  const args = base ? ["diff", "--stat", base] : ["diff", "--stat", "HEAD"];
  try {
    return await run(args, cwd);
  } catch {
    return "";
  }
}

export async function log(n = 5, cwd) {
  try {
    return await run(["log", `--oneline`, `-${n}`], cwd);
  } catch {
    return "";
  }
}

export async function currentBranch(cwd) {
  try {
    return (await run(["rev-parse", "--abbrev-ref", "HEAD"], cwd)).trim();
  } catch {
    return "unknown";
  }
}
