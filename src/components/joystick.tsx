import { useCallback, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Props = {
  onChange: (throttle: number, steer: number) => void;
  className?: string;
};

export function Joystick({ onChange, className }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const active = useRef(false);

  const apply = useCallback(
    (clientX: number, clientY: number) => {
      const el = root.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      let dx = clientX - cx;
      let dy = clientY - cy;
      const max = r.width * 0.38;
      const mag = Math.hypot(dx, dy);
      if (mag > max) {
        dx = (dx / mag) * max;
        dy = (dy / mag) * max;
      }
      setKnob({ x: dx, y: dy });
      const nx = dx / max;
      const ny = dy / max;
      onChange(-ny, -nx);
    },
    [onChange],
  );

  const end = useCallback(() => {
    active.current = false;
    setKnob({ x: 0, y: 0 });
    onChange(0, 0);
  }, [onChange]);

  return (
    <div
      ref={root}
      className={cn(
        "relative size-[132px] rounded-full border border-border bg-surface/80 touch-none select-none",
        className,
      )}
      onPointerDown={(e) => {
        active.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        apply(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => {
        if (!active.current) return;
        apply(e.clientX, e.clientY);
      }}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <div className="absolute inset-[18px] rounded-full border border-border/70" />
      <div
        className="absolute left-1/2 top-1/2 size-11 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent"
        style={{ transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }}
      />
    </div>
  );
}
