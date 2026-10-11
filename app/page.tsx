import { Suspense } from "react";

import { AirMap } from "@/components/air/air-map";
import { SiteHeader } from "@/components/site-header";
import { Skeleton } from "@/components/ui/skeleton";
import { getStationAnnual, getStationReadings } from "@/lib/air-data";
import { getMapStyles } from "@/lib/map-style";

async function AirMapWithData() {
  const [stations, annualStations, styles] = await Promise.all([
    getStationReadings(),
    getStationAnnual(),
    getMapStyles(),
  ]);
  return <AirMap stations={stations} annualStations={annualStations} styles={styles} />;
}

export default function Home() {
  return (
    <div className="relative flex min-h-dvh flex-col lg:h-dvh">
      <SiteHeader />
      <main className="flex min-h-0 flex-1 flex-col">
        <Suspense fallback={<Skeleton className="min-h-105 flex-1 rounded-none" />}>
          <AirMapWithData />
        </Suspense>
      </main>
    </div>
  );
}
