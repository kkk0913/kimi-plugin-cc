import { readFile, writeFile, mkdir, unlink, readdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname } from "node:path";

export async function readJSON(path) {
  try {
    return JSON.parse(await readFile(path, "utf-8"));
  } catch {
    return null;
  }
}

export async function writeJSON(path, data) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(data, null, 2) + "\n");
}

export async function removeFile(path) {
  try {
    await unlink(path);
  } catch {
    // ignore
  }
}

export { existsSync, readFile, writeFile, mkdir, readdir, stat };
