"use client";

import { useState } from "react";
import { ChevronDownIcon, CircleHelpIcon, LayersIcon } from "lucide-react";

import { LayerGuide } from "@/components/air/layer-guide";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";

/**
 * Chooses what the map colours by (decisions #26–#28): a labelled button that
 * always names the active layer, and in the annual view its year (#36),
 * opening a short list ranked by importance for health, with a separate guide
 * for the explanation.
 */
export function LayerPicker<Id extends string>({
  layers,
  value,
  onChange,
  period,
  className,
}: {
  // short: the name on the button on phones, where it shares a row with the period switch.
  layers: readonly { id: Id; label: string; short: string }[];
  value: Id;
  onChange: (layer: Id) => void;
  // Shown after the layer's name, such as the year of an annual map.
  period?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const active = layers.find((l) => l.id === value) ?? layers[0];
  const name = period ? `${active.label} · ${period}` : active.label;
  const shortName = period ? `${active.short} · ${period}` : active.short;

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              variant="outline"
              className={cn("bg-card dark:bg-card h-10 max-w-full gap-2 px-3 shadow-lg max-sm:gap-1.5 max-sm:px-2.5", className)}
              aria-label={`Kaartlaag: ${name}. Kies een andere kaartlaag`}
            />
          }
        >
          <LayersIcon />
          <span className="truncate font-semibold sm:hidden">{shortName}</span>
          <span className="hidden truncate font-semibold sm:inline">{name}</span>
          {/* At the far end when the button is stretched to fill a row. */}
          <ChevronDownIcon className="text-muted-foreground ml-auto" />
        </PopoverTrigger>
        <PopoverContent align="start" className="max-h-(--available-height) w-[min(18rem,calc(100vw-2rem))] gap-2 overflow-y-auto p-2">
          <RadioGroup
            value={value}
            onValueChange={(next) => {
              onChange(next as Id);
              setOpen(false);
            }}
            aria-label="Kaartlaag"
            className="gap-0.5"
          >
            {layers.map((layer) => (
              <label
                key={layer.id}
                className={cn(
                  "hover:bg-muted flex cursor-pointer items-center gap-3 rounded-md px-2.5 py-2",
                  layer.id === value && "bg-brand-soft hover:bg-brand-soft",
                )}
              >
                <RadioGroupItem value={layer.id} />
                <span className="min-w-0 flex-1 font-medium">{layer.label}</span>
              </label>
            ))}
          </RadioGroup>

          <Button
            variant="ghost"
            className="text-brand-text justify-start gap-2"
            onClick={() => {
              setOpen(false);
              setGuideOpen(true);
            }}
          >
            <CircleHelpIcon />
            Welke kaart kies ik?
          </Button>
        </PopoverContent>
      </Popover>
      <LayerGuide open={guideOpen} onOpenChange={setGuideOpen} />
    </>
  );
}
