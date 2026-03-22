import QueryProvider from "./QueryProvider";
import WarningBanner from "./WarningBanner";
import RainAlarm from "./RainAlarm";
import CurrentConditions from "./CurrentConditions";
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

        <section>
          <h2 className="section-title">History</h2>
          <HistoryExplorer />
        </section>
      </div>
    </QueryProvider>
  );
}
