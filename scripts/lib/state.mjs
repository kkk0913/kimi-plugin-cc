import { resolve } from "node:path";
import { readJSON, writeJSON, removeFile, mkdir, readdir } from "./fs.mjs";
import { getWorkspaceSlug } from "./workspace.mjs";

const MAX_JOBS = 50;

function getDataDir() {
  const base = process.env.CLAUDE_PLUGIN_DATA || resolve("/tmp", "kimi-plugin-cc");
  return base;
}

let _wsDir = null;

export async function getWorkspaceDir() {
  if (_wsDir) return _wsDir;
  const slug = await getWorkspaceSlug();
  _wsDir = resolve(getDataDir(), slug);
  await mkdir(_wsDir, { recursive: true });
  return _wsDir;
}

export async function getStatePath() {
  return resolve(await getWorkspaceDir(), "state.json");
}

export async function loadState() {
  const path = await getStatePath();
  return (await readJSON(path)) || { jobs: [], config: {} };
}

export async function saveState(state) {
  const path = await getStatePath();
  await writeJSON(path, state);
}

export async function getJobDir() {
  const wsDir = await getWorkspaceDir();
  const dir = resolve(wsDir, "jobs");
  await mkdir(dir, { recursive: true });
  return dir;
}

export async function saveJob(job) {
  const dir = await getJobDir();
  await writeJSON(resolve(dir, `${job.id}.json`), job);
}

export async function loadJob(jobId) {
  const dir = await getJobDir();
  return readJSON(resolve(dir, `${jobId}.json`));
}

export async function addJobToState(job) {
  const state = await loadState();
  state.jobs.unshift({ id: job.id, command: job.command, startedAt: job.startedAt });
  // Prune old jobs
  if (state.jobs.length > MAX_JOBS) {
    const removed = state.jobs.splice(MAX_JOBS);
    const dir = await getJobDir();
    for (const r of removed) {
      await removeFile(resolve(dir, `${r.id}.json`));
    }
  }
  await saveState(state);
}

export async function getConfig() {
  const state = await loadState();
  return state.config || {};
}

export async function setConfig(key, value) {
  const state = await loadState();
  state.config = state.config || {};
  state.config[key] = value;
  await saveState(state);
}
