"use client";

import { Fragment } from "react";
import { LayersIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MAP_LAYERS, type MapLayer } from "@/lib/air-quality";

/** Chooses what the map colours by: the RIVM area layer and the dots (decisions #26 and #27). */
export function LayerMenu({ value, onChange }: { value: MapLayer; onChange: (layer: MapLayer) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="icon" aria-label="Kaartlagen" className="bg-card dark:bg-card size-10 shadow-lg" />
        }
      >
        <LayersIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="end" className="w-60">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Kleur de kaart op</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={value} onValueChange={(next) => onChange(next as MapLayer)}>
            {MAP_LAYERS.map((layer) => (
              <Fragment key={layer.id}>
                {layer.id === "off" && <DropdownMenuSeparator />}
                <DropdownMenuRadioItem value={layer.id}>{layer.label}</DropdownMenuRadioItem>
              </Fragment>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
