"use client";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { MapPeriod } from "@/lib/air-quality";
import { cn } from "@/lib/utils";

// short: the label on phones, where the switch shares a row with the layer button.
const PERIODS: { id: MapPeriod; label: string; short: string }[] = [
  { id: "nu", label: "Nu", short: "Nu" },
  { id: "jaar", label: "Jaargemiddelde", short: "Jaar" },
];

/** The map's two modes (decision #36): the air of this hour, or the annual average. */
export function PeriodSwitch({
  value,
  onChange,
  className,
}: {
  value: MapPeriod;
  onChange: (period: MapPeriod) => void;
  className?: string;
}) {
  return (
    <ToggleGroup
      value={[value]}
      // A pressed item can be clicked again, which would leave none pressed: ignore that.
      onValueChange={(next) => {
        const period = next[0] as MapPeriod | undefined;
        if (period) onChange(period);
      }}
      spacing={1}
      aria-label="Welke lucht toont de kaart?"
      className={cn("bg-card h-10 rounded-lg border p-1 shadow-lg", className)}
    >
      {PERIODS.map((p) => (
        <ToggleGroupItem
          key={p.id}
          value={p.id}
          aria-label={p.label}
          className="h-8 rounded-md px-3 font-medium aria-pressed:bg-brand-soft aria-pressed:text-brand-text aria-pressed:font-semibold max-sm:px-2.5"
        >
          <span className="sm:hidden">{p.short}</span>
          <span className="hidden sm:inline">{p.label}</span>
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
