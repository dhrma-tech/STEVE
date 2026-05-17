"use client";

import * as React from "react";
import { Command, Loader2, Search } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import type { SearchResultGroup } from "@/lib/search/grouped-search";

type SearchPayload = {
  data?: {
    groups: SearchResultGroup[];
  };
};

export function CommandPalette({
  orgId,
  open,
  onOpenChange
}: {
  orgId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [query, setQuery] = React.useState("");
  const [groups, setGroups] = React.useState<SearchResultGroup[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/orgs/${orgId}/search?q=${encodeURIComponent(query)}`, {
          signal: controller.signal
        });
        const payload = (await response.json()) as SearchPayload;
        setGroups(payload.data?.groups ?? []);
      } catch {
        if (!controller.signal.aborted) setGroups([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 120);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [open, orgId, query]);

  const populatedGroups = groups.filter((group) => group.items.length > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[720px] p-0" showClose={false}>
        <DialogHeader className="border-b border-[var(--border-10)] p-4 pr-4">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Command aria-hidden="true" className="size-4 text-[var(--foreground-80)]" />
            Command palette
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 p-4">
          <Input
            label="Search workspace"
            startIcon={<Search aria-hidden="true" className="size-4" />}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            autoFocus
          />
          <div className="max-h-[54vh] overflow-y-auto">
            {loading ? (
              <div className="flex items-center gap-2 px-1 py-8 text-sm text-[var(--foreground-50)]">
                <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                Searching
              </div>
            ) : populatedGroups.length ? (
              <div className="grid gap-4">
                {populatedGroups.map((group) => (
                  <section key={group.type} className="grid gap-2">
                    <h3 className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--foreground-50)]">{group.label}</h3>
                    <div className="grid gap-1">
                      {group.items.map((item) => (
                        <button
                          key={`${group.type}-${item.id}`}
                          type="button"
                          className="grid gap-1 rounded-[8px] border border-transparent px-3 py-2 text-left outline-none transition-colors hover:border-[var(--border-10)] hover:bg-[var(--foreground-5)] focus-visible:ring-2 focus-visible:ring-[var(--focused)]"
                          onClick={() => {
                            window.location.href = item.href;
                            onOpenChange(false);
                          }}
                        >
                          <span className="text-sm text-[var(--foreground-80)]">{item.title}</span>
                          <span className="text-xs text-[var(--foreground-50)]">{item.subtitle}</span>
                        </button>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <EmptyState surface="dark" title="No results" description="Try a department, file, task, agent, or roadmap item." />
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
