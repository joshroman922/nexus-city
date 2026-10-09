import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function Panel({
  title,
  kicker,
  children,
  onClose,
  wide,
}: {
  title: string;
  kicker?: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  return (
    <aside
      className={cn(
        "absolute right-3 top-20 z-20 flex max-h-[min(72dvh,640px)] flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-[0_12px_40px_rgba(0,0,0,0.35)]",
        wide ? "w-[min(100%-1.5rem,28rem)]" : "w-[min(100%-1.5rem,22rem)]",
      )}
    >
      <header className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          {kicker && (
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
              {kicker}
            </div>
          )}
          <h2 className="font-display text-xl tracking-wide text-fg">{title}</h2>
        </div>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="grid size-9 place-items-center rounded-md text-muted hover:bg-raised hover:text-fg"
        >
          <X className="size-4" />
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">{children}</div>
    </aside>
  );
}
