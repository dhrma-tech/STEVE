import { Bot, Send } from "lucide-react";
import { departmentNodes } from "@/data/marketing-content";
import { Badge } from "@/components/ui/badge";
import { AppPanel } from "@/components/ui/card";

export function OrbitPreview() {
  return (
    <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
      <div className="relative min-h-[520px] overflow-hidden rounded-[16px] border border-[var(--app-border)] bg-[var(--app-canvas)] p-6 text-[var(--app-text)]">
        <div className="absolute left-1/2 top-1/2 size-[310px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-white/18" />
        <div className="absolute left-1/2 top-1/2 size-[170px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10" />
        <div className="absolute left-1/2 top-1/2 grid size-28 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-[18px] border border-[var(--app-border)] bg-[var(--app-black-base)] shadow-[0_0_42px_rgba(98,41,255,0.28)]">
          <Bot aria-hidden="true" className="size-8 text-[var(--brand-300)]" />
          <span className="text-xs text-[var(--app-text-50)]">Cofounder</span>
        </div>
        {departmentNodes.map((node, index) => {
          const angle = (Math.PI * 2 * index) / departmentNodes.length - Math.PI / 2;
          const x = 50 + Math.cos(angle) * 38;
          const y = 50 + Math.sin(angle) * 38;
          const Icon = node.icon;

          return (
            <div
              key={node.name}
              className="absolute grid min-w-[118px] -translate-x-1/2 -translate-y-1/2 gap-1 rounded-[12px] border border-white/10 bg-[rgba(38,38,42,0.92)] p-3 text-center"
              style={{ left: `${x}%`, top: `${y}%` }}
            >
              <Icon aria-hidden="true" className="mx-auto size-5" style={{ color: node.color }} />
              <span className="text-xs text-[var(--app-text-80)]">{node.name}</span>
            </div>
          );
        })}
      </div>

      <AppPanel className="grid content-between gap-6 p-5">
        <div className="grid gap-3">
          <Badge variant="brand">Cofounder chat</Badge>
          <h3 className="text-2xl font-medium tracking-[0px]">Ask once. Route to the right department.</h3>
          <p className="text-sm leading-6 text-[var(--app-text-50)]">
            The side panel keeps company context, department mentions, active tasks, suggested next work, and chat in one dark workspace.
          </p>
        </div>
        <div className="grid gap-3">
          {["What should we build first?", "Engineering can prepare the repo.", "Marketing should define the ICP before outbound."].map((message, index) => (
            <div key={message} className={`rounded-[12px] border border-[var(--app-border)] p-3 text-sm leading-6 ${index === 0 ? "ml-8 bg-[rgba(255,255,255,0.08)]" : "mr-8 bg-[var(--app-black-base)]"}`}>
              {message}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 rounded-[10px] border border-[var(--app-input-border)] bg-[rgba(255,255,255,0.05)] p-2 text-sm text-[var(--app-text-50)]">
          <span className="flex-1 px-2">Ask Cofounder...</span>
          <span className="grid size-8 place-items-center rounded-[8px] bg-[var(--app-primary-light)] text-[var(--app-black-base)]">
            <Send aria-hidden="true" className="size-4" />
          </span>
        </div>
      </AppPanel>
    </div>
  );
}

