import { promises as fs } from "fs";
import path from "path";
import os from "os";
import type { AgentTool } from "./types";

function sandboxDir(sessionId: string) {
  return path.join(os.tmpdir(), "steve-sessions", sessionId);
}

function safePath(sessionId: string, filePath: string): string | null {
  const base = sandboxDir(sessionId);
  const resolved = path.resolve(base, filePath);
  // Guard against path traversal on both Unix and Windows
  if (!resolved.toLowerCase().startsWith(base.toLowerCase())) return null;
  return resolved;
}

export const readFileTool: AgentTool = {
  definition: {
    name: "read_file",
    description: "Read a file from the agent's sandbox working directory.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Relative file path within the sandbox" }
      },
      required: ["path"]
    }
  },
  async execute(input, ctx) {
    const filePath = typeof input.path === "string" ? input.path : "";
    const resolved = safePath(ctx.sessionId, filePath);
    if (!resolved) return "Error: invalid path (path traversal not allowed)";
    try {
      return await fs.readFile(resolved, "utf-8");
    } catch {
      return `Error: file not found at "${filePath}"`;
    }
  }
};

export const writeFileTool: AgentTool = {
  definition: {
    name: "write_file",
    description: "Write content to a file in the agent's sandbox working directory.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Relative file path within the sandbox" },
        content: { type: "string", description: "File content to write" }
      },
      required: ["path", "content"]
    }
  },
  async execute(input, ctx) {
    const filePath = typeof input.path === "string" ? input.path : "";
    const content = typeof input.content === "string" ? input.content : "";
    const resolved = safePath(ctx.sessionId, filePath);
    if (!resolved) return "Error: invalid path (path traversal not allowed)";
    await fs.mkdir(path.dirname(resolved), { recursive: true });
    await fs.writeFile(resolved, content, "utf-8");
    return `File written: "${filePath}" (${content.length} bytes)`;
  }
};

export const listFilesTool: AgentTool = {
  definition: {
    name: "list_files",
    description: "List files in the agent's sandbox working directory.",
    input_schema: {
      type: "object",
      properties: {
        dir: { type: "string", description: "Subdirectory to list (optional, defaults to root sandbox)" }
      }
    }
  },
  async execute(input, ctx) {
    const dir = typeof input.dir === "string" ? input.dir : ".";
    const resolved = safePath(ctx.sessionId, dir);
    if (!resolved) return "Error: invalid path";
    try {
      await fs.mkdir(resolved, { recursive: true });
      const entries = await fs.readdir(resolved, { withFileTypes: true });
      if (!entries.length) return "Sandbox is empty.";
      return entries.map(e => `${e.isDirectory() ? "[dir] " : ""}${e.name}`).join("\n");
    } catch {
      return "Sandbox directory is empty or does not exist.";
    }
  }
};

export const deleteFileTool: AgentTool = {
  definition: {
    name: "delete_file",
    description: "Delete a file from the agent's sandbox working directory.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Relative file path to delete" }
      },
      required: ["path"]
    }
  },
  async execute(input, ctx) {
    const filePath = typeof input.path === "string" ? input.path : "";
    const resolved = safePath(ctx.sessionId, filePath);
    if (!resolved) return "Error: invalid path";
    try {
      await fs.unlink(resolved);
      return `Deleted: "${filePath}"`;
    } catch {
      return `Error: could not delete "${filePath}"`;
    }
  }
};
