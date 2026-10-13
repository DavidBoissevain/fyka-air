import { QUANTITY_NAMES, type BandQuantity } from "@/lib/air-quality";
import { cn } from "@/lib/utils";

// How much each pollutant weighs for long-term health, as a bar length. A
// simplified reading of well-established links (WHO 2021, EEA burden
// estimates), not a medical score. PM10 is short because it largely overlaps PM2.5.
const LONG_TERM: { quantity: BandQuantity; weight: number; label: string }[] = [
  { quantity: "pm25", weight: 1, label: "zwaarst" },
  { quantity: "no2", weight: 0.55, label: "zwaar" },
  { quantity: "o3", weight: 0.2, label: "minder" },
  { quantity: "pm10", weight: 0.2, label: "minder" },
];
const MAIN: BandQuantity[] = ["pm25", "no2"];

/** PM2.5 and NO2 weigh most for long-term health (decision #28). `labels` shows the weight in words. */
export function LongTermBars({ labels, className }: { labels?: boolean; className?: string }) {
  return (
    <dl
      className={cn(
        "grid items-center gap-x-2 gap-y-1 text-xs",
        labels ? "grid-cols-[2.75rem_1fr_3.5rem]" : "grid-cols-[2.75rem_1fr]",
        className,
      )}
    >
      {LONG_TERM.map(({ quantity, weight, label }) => {
        const main = MAIN.includes(quantity);
        return (
          <div key={quantity} className="contents">
            <dt className={cn("tabular-nums", main ? "font-semibold" : "text-muted-foreground")}>
              {QUANTITY_NAMES[quantity]}
            </dt>
            <dd>
              {/* steel-500 in light mode: the lighter steel token is under 3:1 against the card. */}
              <span
                className={cn("block h-2 rounded-xs", main ? "bg-[#5B7BAA] dark:bg-steel" : "bg-[#5B7BAA]/30 dark:bg-steel/30")}
                style={{ width: `${weight * 100}%` }}
              />
              {!labels && <span className="sr-only">{label}</span>}
            </dd>
            {labels && <dd className={cn(main ? "font-medium" : "text-muted-foreground")}>{label}</dd>}
          </div>
        );
      })}
    </dl>
  );
}
