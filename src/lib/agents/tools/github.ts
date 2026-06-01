import { prisma } from "@/lib/db/client";
import type { AgentTool, ToolContext } from "./types";

async function getToken(orgId: string): Promise<string | null> {
  try {
    const integration = await prisma.integration.findFirst({
      where: { organizationId: orgId, provider: "github" }
    });
    if (integration?.configJson) {
      const cfg = JSON.parse(integration.configJson) as { token?: string };
      if (cfg.token) return cfg.token;
    }
  } catch { /* ignore */ }
  return process.env.GITHUB_TOKEN ?? null;
}

async function ghFetch(path: string, token: string, opts?: RequestInit): Promise<unknown> {
  const res = await fetch(`https://api.github.com${path}`, {
    ...opts,
    headers: {
      "Accept": "application/vnd.github+json",
      "Authorization": `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      ...(opts?.headers as Record<string, string> | undefined ?? {})
    }
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`GitHub ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.status === 204 ? null : res.json();
}

function noToken() {
  return "GitHub not configured. Add a token to the GitHub integration or set GITHUB_TOKEN.";
}

export const githubListReposTool: AgentTool = {
  definition: {
    name: "github_list_repos",
    description: "List GitHub repositories accessible to the configured token.",
    input_schema: { type: "object", properties: {} }
  },
  async execute(_input, ctx: ToolContext) {
    const token = await getToken(ctx.orgId);
    if (!token) return noToken();
    try {
      const repos = await ghFetch("/user/repos?sort=updated&per_page=10", token) as Array<{
        full_name: string; description: string | null; private: boolean; default_branch: string
      }>;
      if (!repos.length) return "No repositories found.";
      return repos
        .map(r => `${r.full_name} (${r.private ? "private" : "public"}, branch: ${r.default_branch})\n  ${r.description ?? "No description"}`)
        .join("\n");
    } catch (err) { return `Error: ${String(err)}`; }
  }
};

export const githubReadFileTool: AgentTool = {
  definition: {
    name: "github_read_file",
    description: "Read a file from a GitHub repository.",
    input_schema: {
      type: "object",
      properties: {
        repo: { type: "string", description: "Full repo name, e.g. owner/repo" },
        path: { type: "string", description: "File path in the repository" },
        ref: { type: "string", description: "Branch, tag, or commit SHA (default: main)" }
      },
      required: ["repo", "path"]
    }
  },
  async execute(input, ctx: ToolContext) {
    const token = await getToken(ctx.orgId);
    if (!token) return noToken();
    const repo = typeof input.repo === "string" ? input.repo : "";
    const filePath = typeof input.path === "string" ? input.path : "";
    const ref = typeof input.ref === "string" ? input.ref : "main";
    try {
      const data = await ghFetch(`/repos/${repo}/contents/${filePath}?ref=${encodeURIComponent(ref)}`, token) as {
        content?: string; encoding?: string; name?: string; size?: number
      };
      if (data.encoding === "base64" && data.content) {
        return Buffer.from(data.content.replace(/\n/g, ""), "base64").toString("utf-8");
      }
      return `File: ${data.name} (${data.size} bytes) — binary content not shown`;
    } catch (err) { return `Error: ${String(err)}`; }
  }
};

export const githubCreateBranchTool: AgentTool = {
  definition: {
    name: "github_create_branch",
    description: "Create a new branch in a GitHub repository.",
    input_schema: {
      type: "object",
      properties: {
        repo: { type: "string", description: "Full repo name, e.g. owner/repo" },
        branch: { type: "string", description: "New branch name" },
        from: { type: "string", description: "Base branch name (default: main)" }
      },
      required: ["repo", "branch"]
    }
  },
  async execute(input, ctx: ToolContext) {
    const token = await getToken(ctx.orgId);
    if (!token) return noToken();
    const repo = typeof input.repo === "string" ? input.repo : "";
    const branch = typeof input.branch === "string" ? input.branch : "";
    const from = typeof input.from === "string" ? input.from : "main";
    try {
      const base = await ghFetch(`/repos/${repo}/git/refs/heads/${from}`, token) as { object?: { sha?: string } };
      const sha = base?.object?.sha;
      if (!sha) return `Error: base branch "${from}" not found in ${repo}`;
      await ghFetch(`/repos/${repo}/git/refs`, token, {
        method: "POST",
        body: JSON.stringify({ ref: `refs/heads/${branch}`, sha })
      });
      return `Branch "${branch}" created from "${from}" in ${repo}`;
    } catch (err) { return `Error: ${String(err)}`; }
  }
};

export const githubPushFileTool: AgentTool = {
  definition: {
    name: "github_push_file",
    description: "Create or update a file in a GitHub repository.",
    input_schema: {
      type: "object",
      properties: {
        repo: { type: "string", description: "Full repo name, e.g. owner/repo" },
        path: { type: "string", description: "File path in the repository" },
        content: { type: "string", description: "File content (text)" },
        message: { type: "string", description: "Commit message" },
        branch: { type: "string", description: "Branch to push to (default: main)" }
      },
      required: ["repo", "path", "content", "message"]
    }
  },
  async execute(input, ctx: ToolContext) {
    const token = await getToken(ctx.orgId);
    if (!token) return noToken();
    const repo = typeof input.repo === "string" ? input.repo : "";
    const filePath = typeof input.path === "string" ? input.path : "";
    const content = typeof input.content === "string" ? input.content : "";
    const message = typeof input.message === "string" ? input.message : "Update file";
    const branch = typeof input.branch === "string" ? input.branch : "main";

    let sha: string | undefined;
    try {
      const existing = await ghFetch(`/repos/${repo}/contents/${filePath}?ref=${branch}`, token) as { sha?: string };
      sha = existing.sha;
    } catch { /* file doesn't exist yet — create it */ }

    try {
      await ghFetch(`/repos/${repo}/contents/${filePath}`, token, {
        method: "PUT",
        body: JSON.stringify({
          message,
          content: Buffer.from(content).toString("base64"),
          branch,
          ...(sha ? { sha } : {})
        })
      });
      return `"${filePath}" pushed to ${repo}@${branch}`;
    } catch (err) { return `Error: ${String(err)}`; }
  }
};

export const githubCreatePrTool: AgentTool = {
  definition: {
    name: "github_create_pr",
    description: "Create a pull request on GitHub.",
    input_schema: {
      type: "object",
      properties: {
        repo: { type: "string", description: "Full repo name, e.g. owner/repo" },
        title: { type: "string", description: "PR title" },
        body: { type: "string", description: "PR description (markdown)" },
        head: { type: "string", description: "Branch containing the changes" },
        base: { type: "string", description: "Target branch (default: main)" }
      },
      required: ["repo", "title", "head"]
    }
  },
  async execute(input, ctx: ToolContext) {
    const token = await getToken(ctx.orgId);
    if (!token) return noToken();
    const repo = typeof input.repo === "string" ? input.repo : "";
    const title = typeof input.title === "string" ? input.title : "";
    const body = typeof input.body === "string" ? input.body : "";
    const head = typeof input.head === "string" ? input.head : "";
    const base = typeof input.base === "string" ? input.base : "main";
    try {
      const pr = await ghFetch(`/repos/${repo}/pulls`, token, {
        method: "POST",
        body: JSON.stringify({ title, body, head, base })
      }) as { html_url?: string; number?: number };
      return `PR #${pr.number ?? "?"} created: ${pr.html_url ?? ""}`;
    } catch (err) { return `Error: ${String(err)}`; }
  }
};
