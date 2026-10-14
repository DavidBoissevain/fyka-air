"use client";

import { useId, type ReactNode } from "react";
import { SettingsIcon, type LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldContent, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { setClickValue, useClickValue } from "@/hooks/use-click-value";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

// One row: what the setting does on the left, its control on the right.
function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description: string;
  children: (id: string) => ReactNode;
}) {
  const id = useId();
  return (
    <Field orientation="horizontal" className="items-center justify-between gap-6 py-3.5">
      <FieldContent>
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        <FieldDescription>{description}</FieldDescription>
      </FieldContent>
      {children(id)}
    </Field>
  );
}

function SettingGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-1">
      <h3 className="text-base font-semibold">{title}</h3>
      <div className="divide-y">{children}</div>
    </section>
  );
}

function GeneralSettings() {
  const clickValue = useClickValue();
  return (
    <SettingGroup title="Kaart">
      {/* Decision #54: off by default. */}
      <SettingRow
        label="Waarde tonen waar je klikt"
        description="Klik naast de stippen voor de luchtkwaliteit op die plek. Berekend door het RIVM: een schatting, geen meting."
      >
        {(id) => <Switch id={id} size="lg" checked={clickValue} onCheckedChange={setClickValue} />}
      </SettingRow>
    </SettingGroup>
  );
}

// The sections in the left pane, in this order. Add new ones here.
const SECTIONS: { id: string; label: string; icon: LucideIcon; content: () => ReactNode }[] = [
  { id: "algemeen", label: "Algemeen", icon: SettingsIcon, content: () => <GeneralSettings /> },
];

/** The settings button and dialog: sections listed on the left, their settings on the right. */
export function SettingsDialog({ className }: { className?: string }) {
  // From md up the sections form a column on the left; on phones a row on top.
  const mobile = useIsMobile();
  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button
            variant="outline"
            size="icon"
            aria-label="Instellingen"
            className={cn("bg-card dark:bg-card size-10 shadow-lg", className)}
          />
        }
      >
        <SettingsIcon />
      </DialogTrigger>
      <DialogContent className="h-[min(30rem,calc(100dvh-2rem))] gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <Tabs
          defaultValue={SECTIONS[0].id}
          orientation={mobile ? "horizontal" : "vertical"}
          className="min-h-0 gap-0"
        >
          <nav className="bg-background/60 grid content-start gap-2 border-b p-3 md:w-52 md:shrink-0 md:border-r md:border-b-0">
            <DialogTitle className="text-muted-foreground px-2.5 pt-1 text-xs font-medium">Instellingen</DialogTitle>
            <DialogDescription className="sr-only">Pas aan hoe de kaart werkt.</DialogDescription>
            <TabsList className="w-full gap-1 rounded-none bg-transparent p-0 group-data-horizontal/tabs:h-auto group-data-horizontal/tabs:justify-start">
              {SECTIONS.map(({ id, label, icon: Icon }) => (
                <TabsTrigger
                  key={id}
                  value={id}
                  className="text-muted-foreground hover:bg-muted/60 data-active:bg-card dark:data-active:bg-muted h-9 flex-none gap-2.5 rounded-md px-2.5 group-data-[variant=default]/tabs-list:data-active:shadow-xs dark:data-active:border-transparent"
                >
                  <Icon />
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>
          </nav>
          {SECTIONS.map(({ id, content }) => (
            <TabsContent key={id} value={id} className="min-h-0 overflow-y-auto px-6 py-5">
              {content()}
            </TabsContent>
          ))}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
