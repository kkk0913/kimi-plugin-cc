import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { resolve } from "node:path";

function exec(cmd, args, cwd) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { cwd, timeout: 5000 }, (err, stdout) => {
      if (err) reject(err);
      else resolve(stdout.trim());
    });
  });
}

export async function getWorkspaceSlug(cwd = process.cwd()) {
  let name;
  try {
    const remote = await exec("git", ["remote", "get-url", "origin"], cwd);
    name = remote.replace(/.*\//, "").replace(/\.git$/, "");
  } catch {
    name = resolve(cwd).split("/").pop();
  }
  const hash = createHash("sha256").update(resolve(cwd)).digest("hex").slice(0, 8);
  return `${name}-${hash}`;
}
