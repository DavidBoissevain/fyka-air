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
 * always names the active layer, opening a panel ranked by importance for
 * health, with a short line per layer and a separate guide for more.
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
        <PopoverContent align="start" className="max-h-(--available-height) w-[min(24rem,calc(100vw-2rem))] gap-3 overflow-y-auto p-3">
          <div className="grid gap-1">
            <span className="text-muted-foreground px-1 text-xs">Belangrijkste voor je gezondheid bovenaan</span>
            <RadioGroup
              value={value}
              onValueChange={(next) => {
                onChange(next as MapLayer);
                setOpen(false);
              }}
              aria-label="Kaartlaag"
              className="gap-1"
            >
              {MAP_LAYERS.map((layer) => (
                <label
                  key={layer.id}
                  className={cn(
                    "hover:bg-muted flex cursor-pointer items-start gap-3 rounded-md px-2.5 py-2",
                    layer.id === "off" && "mt-1 border-t pt-3",
                    layer.id === value && "bg-brand-soft hover:bg-brand-soft",
                  )}
                >
                  <RadioGroupItem value={layer.id} className="mt-0.5" />
                  <span className="grid min-w-0 gap-0.5">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="font-medium">{layer.label}</span>
                      {layer.tag && (
                        <Badge variant="outline" className="text-muted-foreground font-normal">
                          {layer.tag}
                        </Badge>
                      )}
                    </span>
                    <span className="text-muted-foreground text-xs">{layer.hint}</span>
                  </span>
                </label>
              ))}
            </RadioGroup>
          </div>

          <Button
            variant="ghost"
            className="text-brand-text justify-start gap-2"
            onClick={() => {
              setOpen(false);
              setGuideOpen(true);
            }}
          >
            <CircleHelpIcon />
            Welke kaart kies ik? Uitleg bij astma, COPD en meer
          </Button>
        </PopoverContent>
      </Popover>
      <LayerGuide open={guideOpen} onOpenChange={setGuideOpen} />
    </>
  );
}
