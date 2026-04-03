/**
 * GitHub API client for GitHub plugin.
 * Supports github.com via REST and GraphQL APIs.
 */

const GITHUB_API_BASE = "https://api.github.com";

function getAuthHeaders() {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (!token) {
    throw new Error("GITHUB_TOKEN or GH_TOKEN environment variable required");
  }
  return {
    "Authorization": `Bearer ${token}`,
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "kimi-plugin-cc",
  };
}

async function githubFetch(path, options = {}) {
  const url = path.startsWith("http") ? path : `${GITHUB_API_BASE}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`GitHub API error (${response.status}): ${error}`);
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return null;
  }

  return response.json();
}

// --- Repository ---

export async function getRepo(owner, repo) {
  return githubFetch(`/repos/${owner}/${repo}`);
}

export async function listRepos(org) {
  if (org) {
    return githubFetch(`/orgs/${org}/repos?per_page=100`);
  }
  return githubFetch(`/user/repos?per_page=100`);
}

// --- Pull Requests ---

export async function getPR(owner, repo, number) {
  return githubFetch(`/repos/${owner}/${repo}/pulls/${number}`);
}

export async function listPRs(owner, repo, state = "open") {
  return githubFetch(`/repos/${owner}/${repo}/pulls?state=${state}&per_page=50`);
}

export async function getPRFiles(owner, repo, number) {
  return githubFetch(`/repos/${owner}/${repo}/pulls/${number}/files`);
}

export async function getPRComments(owner, repo, number) {
  return githubFetch(`/repos/${owner}/${repo}/issues/${number}/comments`);
}

export async function createPRComment(owner, repo, number, body) {
  return githubFetch(`/repos/${owner}/${repo}/issues/${number}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body }),
  });
}

export async function createPRReviewComment(owner, repo, number, commitId, path, position, body) {
  return githubFetch(`/repos/${owner}/${repo}/pulls/${number}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ commit_id: commitId, path, position, body }),
  });
}

// --- Issues ---

export async function getIssue(owner, repo, number) {
  return githubFetch(`/repos/${owner}/${repo}/issues/${number}`);
}

export async function listIssues(owner, repo, state = "open") {
  return githubFetch(`/repos/${owner}/${repo}/issues?state=${state}&per_page=50`);
}

export async function createIssue(owner, repo, title, body, labels = []) {
  return githubFetch(`/repos/${owner}/${repo}/issues`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, body, labels }),
  });
}

export async function createIssueComment(owner, repo, number, body) {
  return githubFetch(`/repos/${owner}/${repo}/issues/${number}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body }),
  });
}

// --- Contents ---

export async function getContents(owner, repo, path, ref = "HEAD") {
  const encodedPath = encodeURIComponent(path);
  return githubFetch(`/repos/${owner}/${repo}/contents/${encodedPath}?ref=${ref}`);
}

export async function getFileContent(owner, repo, path, ref = "HEAD") {
  const data = await getContents(owner, repo, path, ref);
  if (data.content) {
    return Buffer.from(data.content, "base64").toString("utf-8");
  }
  throw new Error("Not a file or empty content");
}

// --- Search ---

export async function searchCode(query) {
  return githubFetch(`/search/code?q=${encodeURIComponent(query)}&per_page=30`);
}

export async function searchRepos(query) {
  return githubFetch(`/search/repositories?q=${encodeURIComponent(query)}&per_page=30`);
}

export async function searchIssues(query) {
  return githubFetch(`/search/issues?q=${encodeURIComponent(query)}&per_page=30`);
}

// --- Commits ---

export async function getCommit(owner, repo, sha) {
  return githubFetch(`/repos/${owner}/${repo}/commits/${sha}`);
}

export async function listCommits(owner, repo, path, ref = "HEAD") {
  const url = `/repos/${owner}/${repo}/commits?sha=${ref}${path ? `&path=${encodeURIComponent(path)}` : ""}&per_page=30`;
  return githubFetch(url);
}

// --- User ---

export async function getAuthenticatedUser() {
  return githubFetch("/user");
}

// --- Comments / Reviews ---

export async function listReviewComments(owner, repo, number) {
  return githubFetch(`/repos/${owner}/${repo}/pulls/${number}/comments`);
}

export async function listReviews(owner, repo, number) {
  return githubFetch(`/repos/${owner}/${repo}/pulls/${number}/reviews`);
}
