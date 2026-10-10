"use client";

import { useState } from "react";
import { ChevronDownIcon, CircleHelpIcon, LayersIcon } from "lucide-react";

import { LayerGuide } from "@/components/air/layer-guide";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { MAP_LAYERS, type MapLayer } from "@/lib/air-quality";
import { cn } from "@/lib/utils";

/**
 * Chooses what the map colours by (decisions #26–#28): a labelled button that
 * always names the active layer, opening a short list ranked by importance for
 * health, with a separate guide for the explanation.
 */
export function LayerPicker({
  value,
  onChange,
  className,
}: {
  value: MapLayer;
  onChange: (layer: MapLayer) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const active = MAP_LAYERS.find((l) => l.id === value) ?? MAP_LAYERS[0];

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              variant="outline"
              className={cn("bg-card dark:bg-card h-10 max-w-full gap-2 px-3 shadow-lg", className)}
              aria-label={`Kaartlaag: ${active.label}. Kies een andere kaartlaag`}
            />
          }
        >
          <LayersIcon />
          <span className="text-muted-foreground hidden sm:inline">Kaart:</span>
          <span className="truncate font-semibold">{active.label}</span>
          <ChevronDownIcon className="text-muted-foreground" />
        </PopoverTrigger>
        <PopoverContent align="start" className="max-h-(--available-height) w-[min(18rem,calc(100vw-2rem))] gap-2 overflow-y-auto p-2">
          <RadioGroup
            value={value}
            onValueChange={(next) => {
              onChange(next as MapLayer);
              setOpen(false);
            }}
            aria-label="Kaartlaag"
            className="gap-0.5"
          >
            {MAP_LAYERS.map((layer) => (
              <label
                key={layer.id}
                className={cn(
                  "hover:bg-muted flex cursor-pointer items-center gap-3 rounded-md px-2.5 py-2",
                  layer.id === value && "bg-brand-soft hover:bg-brand-soft",
                )}
              >
                <RadioGroupItem value={layer.id} />
                <span className="min-w-0 flex-1 font-medium">{layer.label}</span>
                {layer.tag && (
                  <Badge variant="outline" className="text-muted-foreground font-normal">
                    {layer.tag}
                  </Badge>
                )}
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
