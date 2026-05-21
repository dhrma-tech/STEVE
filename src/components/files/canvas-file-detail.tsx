"use client";

import * as React from "react";
import { Archive, Download, X } from "lucide-react";
import type { ApiPayload, LibraryFile } from "@/components/files/types";
import { formatBytes, formatDate, iconForFile, visibilityVariant } from "@/components/files/file-cards";
import { Badge } from "@/components/ui/badge";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";

export function CanvasFileDetail({
  orgId,
  fileId,
  onClose
}: {
  orgId: string;
  fileId: string;
  onClose: () => void;
}) {
  const [file, setFile] = React.useState<LibraryFile | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [archiving, setArchiving] = React.useState(false);

  React.useEffect(() => {
    setLoading(true);
    setError(null);
    setFile(null);
    fetch(`/api/orgs/${orgId}/files/${fileId}`)
      .then((r) => r.json() as Promise<ApiPayload<LibraryFile>>)
      .then((payload) => {
        if (!payload.data) throw new Error(payload.error?.message ?? "File not found.");
        setFile(payload.data);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "File could not be loaded."))
      .finally(() => setLoading(false));
  }, [orgId, fileId]);

  async function archive() {
    if (!file) return;
    setArchiving(true);
    try {
      await fetch(`/api/orgs/${orgId}/files/${file.id}/archive`, { method: "POST" });
      onClose();
    } catch { /* ignore */ } finally {
      setArchiving(false);
    }
  }

  return (
    <div className="flex h-full flex-col bg-[var(--background)]">
      {/* ── Header ── */}
      <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[var(--border-10)] px-6 py-4">
        <div className="flex min-w-0 items-start gap-3">
          {file ? (
            <span className="grid size-10 shrink-0 place-items-center rounded-[10px] border border-[var(--border-10)] bg-[var(--foreground-5)] text-[var(--foreground-80)]">
              {iconForFile(file)}
            </span>
          ) : null}
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold tracking-[-0.3px] text-[var(--foreground)]">
              {file?.preview.title ?? file?.name ?? "File"}
            </h2>
            {file ? (
              <p className="mt-0.5 truncate font-mono text-xs text-[var(--foreground-50)]">
                {file.folder?.name ?? "workspace"}/{file.name}
              </p>
            ) : null}
            {file ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge variant={visibilityVariant(file.visibility)}>{file.visibility}</Badge>
                {file.department ? <Badge variant="neutral">{file.department.name}</Badge> : null}
                {file.task ? <Badge variant="warning">Task file</Badge> : null}
                <Badge variant="neutral">{formatBytes(file.sizeBytes)}</Badge>
                <Badge variant="neutral">Updated {formatDate(file.updatedAt)}</Badge>
              </div>
            ) : null}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex shrink-0 items-center gap-1.5">
          {file ? (
            <>
              <a
                href={file.shareUrl}
                download={file.name}
                title="Download"
                className="grid size-8 place-items-center rounded-[8px] border border-[var(--border-10)] text-[var(--foreground-50)] transition-colors hover:bg-[var(--foreground-5)] hover:text-[var(--foreground-80)]"
              >
                <Download aria-hidden="true" className="size-4" />
              </a>
              <button
                type="button"
                onClick={archive}
                disabled={archiving}
                title="Archive"
                className="grid size-8 place-items-center rounded-[8px] border border-[var(--border-10)] text-[var(--foreground-50)] transition-colors hover:bg-[var(--foreground-5)] hover:text-[var(--destructive)] disabled:pointer-events-none disabled:opacity-40"
              >
                <Archive aria-hidden="true" className="size-4" />
              </button>
            </>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid size-8 place-items-center rounded-[8px] border border-[var(--border-10)] text-[var(--foreground-50)] transition-colors hover:bg-[var(--foreground-5)] hover:text-[var(--foreground-80)]"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="min-h-0 flex-1 overflow-y-auto px-8 py-6">
        {loading ? <LoadingState rows={6} label="Loading file" /> : null}
        {error ? <ErrorState title="File could not be loaded" description={error} /> : null}
        {file && !loading ? <FileContent file={file} /> : null}
      </div>
    </div>
  );
}

function FileContent({ file }: { file: LibraryFile }) {
  const text = file.preview.text;

  if (!text) {
    return (
      <p className="text-sm text-[var(--foreground-50)]">
        {file.preview.message ?? "No inline preview available for this file type."}
      </p>
    );
  }

  const isMarkdown =
    file.mimeType?.includes("markdown") ||
    file.name.endsWith(".md") ||
    file.name.endsWith(".markdown");

  if (isMarkdown) return <MarkdownView text={text} />;

  const isJson = file.mimeType?.includes("json") || file.name.endsWith(".json");
  if (isJson) {
    try {
      return (
        <pre className="whitespace-pre-wrap rounded-[10px] border border-[var(--border-10)] bg-[var(--foreground-3)] p-4 font-mono text-xs leading-6 text-[var(--foreground-80)]">
          {JSON.stringify(JSON.parse(text), null, 2)}
        </pre>
      );
    } catch { /* fall through to raw */ }
  }

  return (
    <pre className="whitespace-pre-wrap font-mono text-sm leading-6 text-[var(--foreground-80)]">{text}</pre>
  );
}

function MarkdownView({ text }: { text: string }) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith("# ")) {
      elements.push(
        <h1 key={i} className="mb-4 mt-8 text-2xl font-bold tracking-[-0.4px] text-[var(--foreground)] first:mt-0">
          {renderInline(line.slice(2))}
        </h1>
      );
    } else if (line.startsWith("## ")) {
      elements.push(
        <h2 key={i} className="mb-3 mt-7 text-xl font-semibold tracking-[-0.2px] text-[var(--foreground)]">
          {renderInline(line.slice(3))}
        </h2>
      );
    } else if (line.startsWith("### ")) {
      elements.push(
        <h3 key={i} className="mb-2 mt-5 text-base font-semibold text-[var(--foreground)]">
          {renderInline(line.slice(4))}
        </h3>
      );
    } else if (/^[-*•] /.test(line)) {
      const listItems: React.ReactNode[] = [];
      while (i < lines.length && /^[-*•] /.test(lines[i])) {
        listItems.push(
          <li key={i} className="leading-6">
            {renderInline(lines[i].replace(/^[-*•] /, ""))}
          </li>
        );
        i++;
      }
      elements.push(
        <ul key={`ul-${i}`} className="mb-4 ml-5 list-disc space-y-1 text-sm text-[var(--foreground-80)]">
          {listItems}
        </ul>
      );
      continue;
    } else if (line.trim() === "") {
      /* blank — skip */
    } else {
      elements.push(
        <p key={i} className="mb-3 text-sm leading-7 text-[var(--foreground-80)]">
          {renderInline(line)}
        </p>
      );
    }

    i++;
  }

  return <div className="max-w-[680px]">{elements}</div>;
}

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return (
    <>
      {parts.map((part, idx) => {
        if (part.startsWith("**") && part.endsWith("**"))
          return <strong key={idx} className="font-semibold text-[var(--foreground)]">{part.slice(2, -2)}</strong>;
        if (part.startsWith("*") && part.endsWith("*"))
          return <em key={idx}>{part.slice(1, -1)}</em>;
        return part;
      })}
    </>
  );
}
