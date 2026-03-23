import { useState } from "react";
import QueryProvider from "./QueryProvider";
import WarningBanner from "./WarningBanner";
import RainAlarm from "./RainAlarm";
import CurrentConditions from "./CurrentConditions";
import SeaConditions from "./SeaConditions";
import SwimIndicator from "./SwimIndicator";
import TodayCharts from "./TodayCharts";
import HourlyForecast from "./HourlyForecast";
import DailyForecast from "./DailyForecast";
import TextForecast from "./TextForecast";
import HistoryExplorer from "./HistoryExplorer";
import Webcams from "./Webcams";

export default function App() {
  return (
    <QueryProvider>
      <div className="space-y-10">
        <WarningBanner />
        <RainAlarm />
        <CurrentConditions />

        <section>
          <h2 className="section-title">Sea Conditions</h2>
          <div className="space-y-5">
            <SeaConditions />
            <SwimIndicator />
          </div>
        </section>

        <section>
          <h2 className="section-title">Today</h2>
          <TodayCharts />
        </section>

        <section>
          <h2 className="section-title">Forecast</h2>
          <div className="space-y-5">
            <HourlyForecast />
            <DailyForecast />
            <TextForecast />
          </div>
        </section>

        <section>
          <h2 className="section-title">Webcams</h2>
          <Webcams />
        </section>

        <CollapsibleSection title="History">
          <HistoryExplorer />
        </CollapsibleSection>
      </div>
    </QueryProvider>
  );
}

function CollapsibleSection({ title, children }: { title: string; children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(true);

  return (
    <section>
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="section-title flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
      >
        <span
          className="transition-transform duration-200"
          style={{ transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)" }}
        >
          ▼
        </span>
        {title}
      </button>
      {!collapsed && <div className="mt-4">{children}</div>}
    </section>
  );
}
